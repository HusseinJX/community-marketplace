// "Tell it what you want, in your own words" → a ranked feed.
//
// One model call per request, and it is a small one: turning a sentence into
// structured facts. Everything expensive already happened at ingest — each
// event was labelled once with who it is for. That split is what makes a
// per-person feed affordable at all (see scraping.md).

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { extractPersona, type PersonaFacts } from '@/lib/reco/audience'
import { rankEvents, diversify, keywordsFrom } from '@/lib/reco/rank'
import { prepare, FEED_COLUMNS, type EventRow } from '@/lib/reco/from-db'
import { rateLimit } from '@/lib/rate-limit'
import { sfToday, sfTomorrow, minutesUntil, startMinutes, isOnNow, hasEnded } from '@/lib/sf-date'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const supabase = () =>
  createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!
  )

/** Cap on candidates pulled before ranking. Ranking is in-memory and cheap. */
const CANDIDATES = 1200

export interface PersonalizeBody {
  text?: string
  lat?: number | null
  lng?: number | null
  /** Explicit UI filters, applied on top of anything read from the sentence. */
  topics?: string[]
  freeOnly?: boolean
  maxMiles?: number | null
  horizonDays?: number
  /** Show only this organiser's events. Matched on the display name, which is
   *  the one identifier a harvested calendar and a real member both have. */
  organizer?: string | null
}

export async function POST(req: Request) {
  // Public and unauthenticated, and every call with text spends a model token —
  // so it is rate-limited per IP like the other open AI endpoints.
  const limited = rateLimit({ req, name: 'events-personalize', limit: 20, windowMs: 60_000 })
  if (limited) return limited

  let body: PersonalizeBody
  try {
    body = (await req.json()) as PersonalizeBody
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const text = (body.text ?? '').trim().slice(0, 400)
  const home =
    typeof body.lat === 'number' && typeof body.lng === 'number'
      ? { lat: body.lat, lng: body.lng }
      : null

  // Read the sentence — but only if there is one. Filters alone are a complete
  // request, and paying a model to parse an empty string would be silly.
  let facts: PersonaFacts = {
    topics: [], energies: [], childAges: [], adultOnlyOk: null, freeOnly: null,
    times: [], prefersOutdoor: null, wantsToMeetPeople: null, maxMiles: null,
    summary: 'Everything happening near you.',
  }
  let parseFailed = false

  if (text) {
    try {
      facts = await extractPersona(text)
    } catch {
      // A dead model must not take the feed down with it: fall back to keyword
      // ranking over the same events rather than showing an error page.
      parseFailed = true
      facts.summary = 'Showing what matches your words.'
    }
  }

  // Explicit UI controls WIN over the sentence. If someone typed "free stuff"
  // and then unticked Free, the tick-box is the more recent, more deliberate
  // statement of intent.
  if (body.topics?.length) facts.topics = body.topics as PersonaFacts['topics']
  if (typeof body.freeOnly === 'boolean') facts.freeOnly = body.freeOnly || null
  if (body.maxMiles !== undefined) facts.maxMiles = body.maxMiles
  if (!home) facts.maxMiles = null // no origin ⇒ a distance filter is meaningless

  const today = sfToday()
  const tomorrow = sfTomorrow()
  const { data, error } = await supabase()
    .from('vendor_events')
    .select(FEED_COLUMNS)
    .eq('active', true)
    .or(`end_date.gte.${today},and(end_date.is.null,event_date.gte.${today})`)
    .order('event_date', { ascending: true })
    .limit(CANDIDATES)

  if (error) {
    return NextResponse.json({ error: 'Could not load events' }, { status: 500 })
  }

  const { events: dated, audience } = prepare((data ?? []) as unknown as EventRow[], { from: today })

  // Drop what has already finished. Only ever removes an event whose source
  // STATED an end time that has now passed — "started, no stated end" survives,
  // because not knowing when something finishes is not evidence that it has.
  //
  // Done here rather than in the UI so a finished event does not silently eat
  // one of the sixty slots the feed has to give away.
  const events = dated.filter((e) => !hasEnded(e.date, e.start))

  // A TAPPED topic is a hard filter; a topic merely *inferred* from a sentence
  // is not.
  //
  // The distinction is what the person actually did. Tapping "Music" is a
  // deliberate, unambiguous statement, and a pill that only re-weighted the
  // ranking left the same 763 events in the list — music rose to the top and
  // everything else was still sitting right underneath it, which reads as
  // broken. Whereas "I want more reading events" is a mood, and hard-filtering
  // a mood throws away things the person would have been glad to see.
  //
  // Unlabelled events are excluded too: with no topics recorded we cannot claim
  // it matches, and claiming it anyway is the failure this codebase is built to
  // avoid.
  const chips = body.topics ?? []

  // Narrow to one organiser, when asked. Matched on the label rather than an
  // id because a scraped event's "host" is a calendar with a synthetic member
  // id, while an in-app event's is a real one — the name is what both have and
  // what the reader actually tapped.
  const organizer = body.organizer?.trim() || null

  // Say what the feed is actually showing. With chips on and no sentence, the
  // default line ("Everything happening near you") is simply untrue.
  if (organizer && !text) {
    facts.summary = `Everything from ${organizer}${home ? ', nearest first' : ''}.`
  } else if (chips.length && !text) {
    const names = chips.map((t) => t.replace(/-/g, ' & '))
    const list =
      names.length === 1
        ? names[0]
        : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
    facts.summary = `${list.charAt(0).toUpperCase()}${list.slice(1)}${home ? ', nearest first' : ''}.`
  }

  let candidates = organizer ? events.filter((e) => e.sourceLabel === organizer) : events
  let droppedByTopic = 0
  if (chips.length) {
    const want = new Set(chips)
    candidates = candidates.filter((e) => {
      const have = audience[e.uid]?.topics ?? []
      const hit = have.some((t) => want.has(t))
      if (!hit) droppedByTopic++
      return hit
    })
  }

  const { ranked, filtered } = rankEvents(candidates, {
    facts,
    audience,
    home,
    horizonDays: body.horizonDays ?? 45,
    keywords: text ? keywordsFrom(text) : [],
  })

  // Spread the head across sources and days — otherwise the library, which
  // publishes daily and in volume, supplies the entire first screen.
  //
  // NOT applied to a plain browse with a known location. There the promise the
  // UI makes is literally "nearest first", and the per-source cap would push a
  // library event two blocks away below a gallery event two miles off, purely
  // for variety. Variety is worth that trade when someone asked for a KIND of
  // thing; it isn't when the only thing they asked for is what's close.
  const askedForSomething = !!text || (body.topics?.length ?? 0) > 0 || !!organizer
  const ordered = askedForSomething || !home ? diversify(ranked) : ranked
  const spread = ordered.slice(0, 60)

  return NextResponse.json({
    summary: facts.summary,
    parseFailed,
    facts: {
      topics: facts.topics,
      energies: facts.energies,
      childAges: facts.childAges,
      freeOnly: facts.freeOnly,
      maxMiles: facts.maxMiles,
      times: facts.times,
    },
    filtered: droppedByTopic ? { ...filtered, 'a different kind of thing': droppedByTopic } : filtered,
    total: ranked.length,
    events: spread.map((s) => ({
      id: s.event.uid,
      title: s.event.title,
      date: s.event.date,
      time: s.event.start,
      venue: s.event.venue,
      source: s.event.sourceLabel,
      sourceId: s.event.sourceId === 'community' ? null : s.event.sourceId,
      image: s.event.imageUrl,
      free: s.event.free,
      miles: s.miles == null ? null : Math.round(s.miles * 10) / 10,
      // Minutes until it starts, in CITY time — computed here rather than in
      // the browser so a phone with a skewed clock, or a reader outside the
      // Pacific timezone, still gets "in 2h" measured against San Francisco.
      // Null when it isn't today or has no readable start time.
      startsInMin: minutesUntil(s.event.date, s.event.start),
      // Clock start as minutes-since-midnight, for ordering WITHIN a day on
      // every day — startsInMin only exists for today. Null when the source
      // gave no readable time ("All day").
      startMin: startMinutes(s.event.start),
      // Under way right now — uses the END time when the source gave one, so a
      // half-hour talk that began two hours ago is correctly over rather than
      // being promoted to the top of the feed.
      onNow: isOnNow(s.event.date, s.event.start),
      day: s.event.date === today ? 'today' : s.event.date === tomorrow ? 'tomorrow' : 'later',
      why: s.why,
      topics: audience[s.event.uid]?.topics ?? [],
    })),
  })
}
