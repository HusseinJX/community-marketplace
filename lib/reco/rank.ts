// Ranking a feed for one person.
//
// Two layers, doing different jobs:
//
//   HARD FILTERS come from structured facts — age fit, budget, availability,
//   distance. These are promises. If someone says "free only" or "I'm bringing a
//   4-year-old", a paid adults-only event is not a worse match, it is a wrong one.
//
//   SOFT RANKING blends topic overlap, energy fit, embedding similarity,
//   proximity and timing. This is taste, and it is allowed to be fuzzy.
//
// Explanations come from the FACTS, never from the embedding. An earlier version
// inferred reasons from cosine similarity and confidently told people a
// job-hunting talk "matches your interest in art". Facts can't do that.

import { cosine } from './embed'
import { milesBetween } from '@/lib/sources/geo'
import type { ScrapedEvent } from '@/lib/sources/types'
import type { EventAudience, PersonaFacts, Topic } from './audience'

export interface Scored {
  event: ScrapedEvent
  score: number
  similarity: number
  miles: number | null
  why: string[]
}

const WEIGHTS = {
  topics: 0.30, // do the labelled topics overlap what they asked for
  similarity: 0.25, // does the text feel like their kind of thing
  proximity: 0.22, // can they actually get there
  soon: 0.13, // is it happening while they still care
  energy: 0.07, // chill vs lively
  free: 0.03, // a nudge, not a filter
}

/**
 * Words from the person's own sentence, matched against the event text.
 *
 * This exists because the 21-topic vocabulary is coarse by design. "mahjong",
 * "salsa", "birding" are all `community-civic` or nothing at all — so a feed
 * ranked on topics alone answers "any mahjong?" with whatever is nearest.
 * Embedding similarity covered this in the prototype; where vectors are not
 * loaded, a literal word match covers the same ground for nothing.
 *
 * Stopwords are dropped so "i want more things" doesn't match every event that
 * happens to contain "more".
 */
const STOP = new Set([
  'i', 'a', 'an', 'the', 'want', 'more', 'some', 'something', 'stuff', 'things', 'thing',
  'like', 'love', 'find', 'show', 'me', 'my', 'and', 'or', 'for', 'to', 'of', 'in', 'on',
  'with', 'near', 'nearby', 'around', 'this', 'that', 'is', 'are', 'am', 'be', 'do', 'any',
  'event', 'events', 'go', 'going', 'get', 'have', 'has', 'would', 'can', 'new', 'good',
])

export function keywordsFrom(text: string): string[] {
  return [
    ...new Set(
      text
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 2 && !STOP.has(w))
    ),
  ].slice(0, 8)
}

function keywordScore(words: string[], e: ScrapedEvent, a?: EventAudience): number {
  if (!words.length) return 0
  // Title is the strongest signal, then the stated audience, then the blurb.
  const title = e.title.toLowerCase()
  const ideal = (a?.idealAudience ?? '').toLowerCase()
  const body = `${e.description ?? ''} ${e.tags.join(' ')}`.toLowerCase()
  let best = 0
  for (const w of words) {
    if (title.includes(w)) best = Math.max(best, 1)
    else if (ideal.includes(w)) best = Math.max(best, 0.8)
    else if (body.includes(w)) best = Math.max(best, 0.5)
  }
  return best
}

/**
 * `community-civic` lands on 65% of events — the model reaches for it whenever
 * something is broadly public. It is nearly information-free, so it counts for
 * much less than a specific topic like `books-writing`.
 */
const WEAK_TOPICS = new Set<Topic>(['community-civic'])

function topicScore(want: Topic[], have: Topic[]): number {
  if (!want.length || !have.length) return 0
  let best = 0
  for (const t of want) {
    if (!have.includes(t)) continue
    best = Math.max(best, WEAK_TOPICS.has(t) ? 0.35 : 1)
  }
  return best
}

function proximityScore(miles: number | null, radius: number): number {
  if (miles == null) return 0.35 // unplaced: neither rewarded nor buried
  if (miles <= 0.25) return 1
  if (miles >= radius) return 0
  return 1 - miles / radius
}

function soonScore(date: string, horizonDays: number): number {
  const days = Math.max(0, (Date.parse(date + 'T12:00:00Z') - Date.now()) / 864e5)
  return days > horizonDays ? 0 : 1 - days / horizonDays
}

function fmtMiles(m: number): string {
  return m < 0.2 ? 'right here' : m < 10 ? `${m.toFixed(1)} mi away` : `${Math.round(m)} mi away`
}

/**
 * Hard eligibility. Returns a reason string when the event is ruled OUT, so a
 * filter decision can always be explained (and debugged) rather than silently
 * shrinking the feed.
 */
function ineligible(
  e: ScrapedEvent,
  a: EventAudience | undefined,
  p: PersonaFacts,
  miles: number | null
): string | null {
  if (p.freeOnly && e.free !== true) return 'not free'

  if (p.maxMiles != null) {
    if (miles != null && miles > p.maxMiles) return 'too far'
    // An event we could not place cannot be promised as nearby. Letting these
    // through meant someone who said "no car" got a feed led by events with no
    // pin at all — some of them 180 miles away. A distance filter that silently
    // exempts everything it failed to geocode is not a filter.
    if (miles == null) return 'location unknown'
  }

  if (p.childAges.length) {
    if (a?.adultsOnly === true) return 'adults only'
    // Requires a POSITIVE signal, not merely the absence of a negative.
    // `kidsWelcome` is null whenever the source didn't say — and the labeller is
    // told never to guess — so "not ruled out" swept in grant-writing seminars
    // and a caregiver support group for someone bringing a 4-year-old. When a
    // person tells us they have a child with them, an unknown is a no.
    if (a?.kidsWelcome !== true) {
      // An explicit age range that fits is its own positive signal.
      const rangeFits =
        (a?.minAge != null || a?.maxAge != null) &&
        p.childAges.some((age) => age >= (a!.minAge ?? 0) && age <= (a!.maxAge ?? 200))
      if (!rangeFits) return a?.kidsWelcome === false ? 'not for kids' : 'not stated for kids'
    }
    // Respect a stated age range when the event gives one. A 4-year-old at a
    // teens-only workshop is a wasted trip, not a near miss.
    if (a?.minAge != null || a?.maxAge != null) {
      const fits = p.childAges.some(
        (age) => age >= (a.minAge ?? 0) && age <= (a.maxAge ?? 200)
      )
      if (!fits) return 'outside the age range'
    }
  }

  // Only filter on time when BOTH sides stated one.
  if (p.times.length && a?.timeOfDay && !p.times.includes(a.timeOfDay)) return 'wrong time of day'

  return null
}

/** Reasons, drawn from facts. Strongest first, at most three. */
function reasons(
  e: ScrapedEvent,
  a: EventAudience | undefined,
  p: PersonaFacts,
  miles: number | null,
  matched: Topic[],
  hitWord?: string | null
): string[] {
  const why: string[] = []

  // The single most useful line: who the event says it is for.
  if (a?.idealAudience) why.push(`for ${a.idealAudience}`)

  if (p.childAges.length && a?.minAge != null && a.maxAge != null) {
    const kid = p.childAges.find((age) => age >= a.minAge! && age <= a.maxAge!)
    if (kid != null) why.push(`ages ${a.minAge}–${a.maxAge}, fits your ${kid}-year-old`)
  }

  if (!why.length && matched.length) {
    why.push(`${matched[0].replace(/-/g, ' ')} — what you asked for`)
  }

  // A literal hit is a fact about the text, so it can be stated as one. Only
  // used when the event offered no audience of its own — never as a dressed-up
  // version of "we had nothing better".
  if (!why.length && hitWord) why.push(`mentions “${hitWord}”`)

  if (p.energies.length && a?.energy && p.energies.includes(a.energy)) {
    why.push(a.energy === 'quiet' ? 'a calm one' : a.energy === 'lively' ? 'a lively one' : 'sociable')
  }

  if (miles != null && (miles < 1.2 || (p.maxMiles != null && miles <= p.maxMiles))) {
    why.push(fmtMiles(miles))
  }

  const days = Math.round((Date.parse(e.date + 'T12:00:00Z') - Date.now()) / 864e5)
  if (days <= 0) why.push('today')
  else if (days === 1) why.push('tomorrow')
  else if (days <= 7) why.push(`in ${days} days`)

  if (e.free === true) why.push('free')
  if (a?.format === 'drop-in') why.push('just turn up')
  if (p.wantsToMeetPeople && a?.newcomerFriendly) why.push('easy to arrive alone')

  return why.slice(0, 3)
}

export interface RankOpts {
  facts: PersonaFacts
  profileVector?: number[]
  vectors?: Record<string, number[]>
  audience: Record<string, EventAudience>
  home?: { lat: number; lng: number } | null
  horizonDays?: number
  limit?: number
  /** The person's raw words, for literal matching when vectors aren't loaded. */
  keywords?: string[]
}

export interface RankResult {
  ranked: Scored[]
  /** Why events were ruled out, so the filters are inspectable. */
  filtered: Record<string, number>
}

export function rankEvents(events: ScrapedEvent[], opts: RankOpts): RankResult {
  const { facts: p, profileVector, vectors, audience, home } = opts
  const radius = p.maxMiles ?? 8
  const horizon = opts.horizonDays ?? 30
  const words = opts.keywords ?? []

  // Keywords stand in for embedding similarity when no vectors are supplied.
  // They occupy the same slot rather than adding a new one, so the weights
  // still sum to 1 and scores stay comparable between the two modes.
  const haveVectors = !!profileVector && !!vectors

  // Weight what the person actually gave us.
  //
  // Someone who says only "chill stuff" has expressed ONE preference — energy —
  // and at the default 7% it was losing to proximity, which put a Roller Disco
  // Party in a feed asked to be calm. When there are no topics, the topic weight
  // belongs to the signals they did give.
  const w = p.topics.length
    ? WEIGHTS
    : {
        ...WEIGHTS,
        topics: 0,
        energy: p.energies.length ? WEIGHTS.energy + 0.18 : WEIGHTS.energy,
        similarity: WEIGHTS.similarity + (p.energies.length ? 0.12 : 0.3),
      }

  const filtered: Record<string, number> = {}
  const scored: Scored[] = []

  for (const e of events) {
    const a = audience[e.uid]
    const miles = home && e.lat != null && e.lng != null
      ? milesBetween(home, { lat: e.lat, lng: e.lng })
      : null

    const out = ineligible(e, a, p, miles)
    if (out) {
      filtered[out] = (filtered[out] ?? 0) + 1
      continue
    }

    const have = (a?.topics ?? []) as Topic[]
    const matched = p.topics.filter((t) => have.includes(t))
    const tScore = topicScore(p.topics, have)

    const v = vectors?.[e.uid]
    const sim = profileVector && v ? cosine(profileVector, v) : 0
    const simNorm = haveVectors
      ? Math.max(0, Math.min(1, (sim - 0.05) / 0.4))
      : keywordScore(words, e, a)

    const energyFit = p.energies.length && a?.energy ? (p.energies.includes(a.energy) ? 1 : 0) : 0.5

    const score =
      w.topics * tScore +
      w.similarity * simNorm +
      w.proximity * proximityScore(miles, radius) +
      w.soon * soonScore(e.date, horizon) +
      w.energy * energyFit +
      w.free * (e.free === true ? 1 : 0)

    const hitWord = haveVectors
      ? null
      : words.find((w) => e.title.toLowerCase().includes(w)) ?? null

    scored.push({
      event: e, score, similarity: sim, miles,
      why: reasons(e, a, p, miles, matched, hitWord),
    })
  }

  scored.sort((a, b) => b.score - a.score)
  return { ranked: opts.limit ? scored.slice(0, opts.limit) : scored, filtered }
}

/**
 * Spread the top of the feed across sources and days.
 *
 * Without this the library alone supplies the first twenty slots and the feed
 * stops feeling like a city.
 */
export function diversify(ranked: Scored[], perSource = 3, perDay = 6): Scored[] {
  const bySource = new Map<string, number>()
  const byDay = new Map<string, number>()
  const head: Scored[] = []
  const tail: Scored[] = []

  for (const r of ranked) {
    const s = bySource.get(r.event.sourceId) ?? 0
    const d = byDay.get(r.event.date) ?? 0
    if (s < perSource && d < perDay) {
      head.push(r)
      bySource.set(r.event.sourceId, s + 1)
      byDay.set(r.event.date, d + 1)
    } else {
      tail.push(r)
    }
  }
  return [...head, ...tail]
}
