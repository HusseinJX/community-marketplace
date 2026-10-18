import 'server-only'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { unstable_cache, revalidateTag } from 'next/cache'
import { getOpenAI, CHAT_MODEL } from '@/lib/openai'
import { isHiddenMember } from '@/lib/hidden-members'
import { sfToday } from '@/lib/sf-date'

// Seeded feed content — features/community-feed-seeding.md, phase 1.
//
// Everything here lives in `feed_items`, never `posts`. Two kinds of row:
//
//   WhatsLocal (account 'whatslocal', status 'live') — shown in the feed as
//   itself, in its own card: event recaps. (Three house-voice "how to post"
//   items were tried and dropped the same day — the app talking about itself
//   is the thing nobody stops scrolling for.)
//
//   Xeno drafts (account 'xeno', status 'draft') — written FOR the founder to
//   edit and post as himself. Posting one creates a real row in `posts` under
//   his own account; the draft is never rendered. This is the spec's line:
//   AI may draft, but nothing is published under a real person's name until
//   that person has read it and pressed the button.
//
// THE MODEL RUNS ONCE PER ITEM. A recap or a Xeno draft is one call when it
// is written, and the sentence is stored. Nothing on a read path calls a model.

let client: SupabaseClient | null = null
function db(): SupabaseClient {
  if (!client) {
    const url = process.env.SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')
    client = createClient(url, key, { auth: { persistSession: false } })
  }
  return client
}

export interface FeedItemRow {
  id: string
  layer: string
  account: string
  status: 'live' | 'draft' | 'posted' | 'skipped'
  title: string | null
  body: string
  image_url: string | null
  link_url: string | null
  link_label: string | null
  event_id: string | null
  event_date: string | null
  venue: string | null
  neighborhood: string | null
  lat: number | null
  lng: number | null
  post_id: string | null
  published_at: string
  expires_at: string | null
  hidden_at: string | null
}

/** What the feed renders — no drafts, nothing internal. */
export type PublicFeedItem = Pick<
  FeedItemRow,
  'id' | 'layer' | 'title' | 'body' | 'image_url' | 'link_url' | 'link_label' | 'event_id' | 'event_date' | 'venue' | 'neighborhood' | 'lat' | 'lng' | 'published_at'
>

const TAG = 'feed-items'

// Calendars whose events are logistics, not stakes (spec: "stakes, not
// logistics"). A recap of last Tuesday's toddler storytime or a grand-rounds
// lecture teaches people the feed is a schedule. They still appear as events.
const RECAP_SKIP_SOURCES = new Set(['ucsf', 'sfpl'])

const RECAP_LIFESPAN_DAYS = 4

// ── Read path ───────────────────────────────────────────────────────────────

/**
 * Live WhatsLocal items, newest first. Cached for everyone (the content is
 * identical per viewer) and tagged so a pause, resume or generate shows at once.
 *
 * FEED_ITEMS_OFF=1 is the env kill switch; the Pause button in super-admin is
 * the no-restart one (it stamps hidden_at).
 */
export const listLiveFeedItems = unstable_cache(
  async (limit: number): Promise<PublicFeedItem[]> => {
    if (process.env.FEED_ITEMS_OFF === '1') return []
    const now = new Date().toISOString()
    const { data, error } = await db()
      .from('feed_items')
      .select('id, layer, title, body, image_url, link_url, link_label, event_id, event_date, venue, neighborhood, lat, lng, published_at')
      .eq('account', 'whatslocal')
      .eq('status', 'live')
      .is('hidden_at', null)
      .lte('published_at', now)
      .or(`expires_at.is.null,expires_at.gt.${now}`)
      .order('published_at', { ascending: false })
      .limit(limit)
    if (error) throw new Error(error.message)
    return (data ?? []) as PublicFeedItem[]
  },
  ['feed-items-live-v5'],
  { revalidate: 300, tags: [TAG] },
)

// `{ expire: 0 }`, not 'max': 'max' is stale-while-revalidate, which would
// serve one more copy of a feed the Pause button was pressed to take down.
export function invalidateFeedItems() {
  try {
    revalidateTag(TAG, { expire: 0 })
  } catch {
    /* outside a revalidatable context — the 5-minute TTL still bounds it */
  }
}

// ── Event recaps ────────────────────────────────────────────────────────────

interface EventRow {
  id: string
  member_id: string | null
  title: string | null
  event_date: string | null
  end_date: string | null
  location: string | null
  poster_image_url: string | null
  source_id: string | null
  event_url: string | null
  neighborhood: string | null
  lat: number | null
  lng: number | null
  description?: string | null
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}/

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function weekday(iso: string): string {
  return new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' })
}

/**
 * Scraped titles carry their own asides: "Costume Sale (Oct. 17-18)",
 * "DJ Night (Madrone Art Bar)", "Free Tokens (Every Monday)". Fine in a
 * listing; in a sentence that already says when and where, they repeat it.
 */
function cleanTitle(t: string): string {
  return t.replace(/\s*\([^()]*\)\s*$/, '').trim() || t.trim()
}

/** "Fort Mason Center, 2 Marina Blvd" → "Fort Mason Center". */
function venueOf(location: string | null): string | null {
  const v = (location ?? '').split(',')[0].trim()
  return v.length >= 3 && v.length <= 60 ? v : null
}

// WhatsLocal's voice for a recap. The rule that matters: we were not there.
// A recap may say what an event WAS — never how it went. "Packed", "sold
// out", "15,000 people showed up" would be claims about a real event that
// nobody checked, published under our name.
const RECAP_SYSTEM = [
  'You write one short feed post for WhatsLocal, a local app in San Francisco, about an event that just happened.',
  'Write 1–2 sentences, under 160 characters, past tense, starting with the weekday ("Sunday", "Saturday night").',
  'Say what the event WAS, built around its single most specific, interesting real detail: a name, a number, an odd fact.',
  'Rules:',
  '- NEVER say how it went: no attendance, crowds, "packed", "sold out", "a hit", "success", "people loved", "vibes". You were not there.',
  '- No first person, no "we", no opinions about any business.',
  '- Plain and specific, like a good caption. No hashtags, no emoji, no exclamation marks, no "join", "don\'t miss", "check out", "experience".',
  '- Only facts from the description. Never the year.',
  'Examples of the voice:',
  '"Saturday was the Sunset Night Market: 40 stalls on Irving between 19th and 25th, and a dumpling line that went around the corner of 22nd."',
  '"Sunday, the Conservatory of Flowers ran a workshop on blending tea from fall herbs, taught by herbalist Allie Brown."',
  'Return only the post text.',
].join('\n')

const RECAP_BANNED = /\b(packed|sold out|crowds?|a hit|success|loved|vibes?|amazing|incredible|join|don'?t miss|check out|experience|we|our|I)\b|!|#/i

async function recapText(e: EventRow, weekdayName: string, venue: string | null): Promise<string | null> {
  const facts = [
    `Event: ${cleanTitle(e.title ?? '')}`,
    `It happened on ${weekdayName}.`,
    venue ? `Where: ${venue}` : e.location ? `Where: ${e.location}` : '',
    e.description ? `Description: ${e.description.slice(0, 1200)}` : '',
  ].filter(Boolean).join('\n')
  let feedback = ''
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await getOpenAI().chat.completions.create({
      model: CHAT_MODEL,
      temperature: 0.6,
      max_tokens: 120,
      messages: [
        { role: 'system', content: RECAP_SYSTEM },
        { role: 'user', content: facts + feedback },
      ],
    })
    let text = res.choices[0]?.message?.content?.trim() ?? ''
    if (/^["“][\s\S]*["”]$/.test(text) && !/^["“][^"”]*["”]\s\S/.test(text)) text = text.slice(1, -1).trim()
    const broken = text.match(RECAP_BANNED)?.[0]
    if (text.length >= 20 && text.length <= 220 && !broken) return text
    feedback = `\n\nYour last version broke a rule (${broken ? `it used "${broken}"` : 'wrong length'}). Write it again.`
  }
  return null
}

/**
 * Write WhatsLocal posts for these exact events, once, published now.
 *
 * Hand-picked, not generated in bulk (2026-10-18): the first version wrote
 * one for every upcoming event — 276 rows, 133 of them repeats — when the
 * point is a FEW posts so the feed looks alive. Whoever calls this chooses the
 * events; this only writes the sentence (rules above) and stores it. Pick
 * events that have FINISHED — the post says they happened.
 */
export async function postRecapsFor(
  eventIds: string[],
  /** When they count as posted. The feed is newest-first, so an earlier time puts them further down. */
  publishedAt: Date = new Date(),
): Promise<{ title: string; body: string }[]> {
  const { data, error } = await db()
    .from('vendor_events')
    .select('id, member_id, title, event_date, end_date, location, poster_image_url, source_id, event_url, neighborhood, lat, lng, description')
    .in('id', eventIds)
  if (error) throw new Error(`events: ${error.message}`)

  const now = publishedAt
  const expires = new Date(now.getTime() + RECAP_LIFESPAN_DAYS * 86_400_000)
  const out: { title: string; body: string }[] = []
  for (const e of (data ?? []) as EventRow[]) {
    const venue = venueOf(e.location)
    const body = await recapText(e, weekday(e.event_date ?? sfToday()), venue)
    if (!body) continue
    const title = cleanTitle(e.title ?? '')
    const { error: upErr } = await db()
      .from('feed_items')
      .upsert(
        {
          layer: 'event',
          account: 'whatslocal',
          status: 'live',
          title,
          body,
          image_url: e.poster_image_url,
          link_url: e.event_url,
          link_label: e.event_url ? 'Event page' : null,
          event_id: e.id,
          event_date: e.event_date?.slice(0, 10) ?? null,
          venue,
          neighborhood: e.neighborhood,
          lat: e.lat,
          lng: e.lng,
          published_at: now.toISOString(),
          expires_at: expires.toISOString(),
          source_id: 'event_recap',
          external_uid: e.id,
        },
        { onConflict: 'source_id,external_uid', ignoreDuplicates: true },
      )
    if (upErr) throw new Error(`recap: ${upErr.message}`)
    out.push({ title, body })
  }
  invalidateFeedItems()
  return out
}

// ── Xeno drafts ─────────────────────────────────────────────────────────────

// The spec's voice and identity rules, as the prompt. The one that matters
// most: this is drafted for a REAL person, so it may recommend an event but
// must never claim he went, ate, saw or loved anything.
const DRAFT_SYSTEM = [
  'You draft a short post for Xeno, the founder of WhatsLocal, a local community app in San Francisco.',
  'He reads and edits it, then posts it as himself. It should sound like a person telling friends about something coming up — not a listing, not a press release.',
  'Write ONE post: 1–2 short sentences, under 180 characters.',
  'Rules:',
  '- Never claim a first-person experience: no "I went", "I tried", "I loved", "my favourite", "I can\'t wait". It is a pointer, not a testimonial.',
  '- Never rate or praise a business. Talk about the event.',
  '- Lead with the most specific, interesting real detail from the description: a name, a time, a number, a strange fact.',
  '- Say when with the weekday ("Saturday", "Thursday at 7") — never "today" or "tomorrow" (it may be posted days later), never the full date, never the year.',
  '- Banned: "join", "unique opportunity", "invites", "enjoy", "featuring", "don\'t miss", "check out", "experience", hashtags, emoji, exclamation marks.',
  '- Only use facts in the description. If a fact is not there, leave it out.',
  'Two examples of the voice:',
  '"North Beach Festival is this weekend. Grant and Green close, 90-odd vendors, and the pizza-tossing thing that\'s either great or deeply embarrassing."',
  '"Sunday Streets takes over Mission Saturday, 16th to 19th, 9 to 6. No cars for three blocks."',
  'Return only the post text.',
].join('\n')

// The rules a model most often breaks, checked rather than trusted. A draft
// that trips one is retried once with the reason; a second miss is dropped.
const DRAFT_BANNED = /\b(today|tomorrow|tonight|join|unique opportunity|invites?|enjoy|featuring|don'?t miss|check out|experience|perfect for|I went|I tried|I loved|my favou?rite)\b|!|#/i

async function draftText(e: EventRow): Promise<string | null> {
  const facts = [
    `Event: ${cleanTitle(e.title ?? '')}`,
    `Today is ${sfToday()} (${weekday(sfToday())}).`,
    `Date: ${e.event_date}${e.end_date && e.end_date !== e.event_date ? ` to ${e.end_date}` : ''} (${weekday(e.event_date ?? sfToday())})`,
    e.location ? `Where: ${e.location}` : '',
    e.description ? `Description: ${e.description.slice(0, 1200)}` : '',
  ].filter(Boolean).join('\n')

  let feedback = ''
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await getOpenAI().chat.completions.create({
      model: CHAT_MODEL,
      temperature: 0.6,
      max_tokens: 160,
      messages: [
        { role: 'system', content: DRAFT_SYSTEM },
        { role: 'user', content: facts + feedback },
      ],
    })
    let text = res.choices[0]?.message?.content?.trim() ?? ''
    // Strip wrapping quotes only when the WHOLE reply is quoted — a reply that
    // opens with a quoted title must keep its quote.
    if (/^["“][\s\S]*["”]$/.test(text) && !/^["“][^"”]*["”]\s\S/.test(text)) text = text.slice(1, -1).trim()
    const broken = text.match(DRAFT_BANNED)?.[0]
    if (text.length >= 20 && !broken) return text
    feedback = `\n\nYour last draft broke a rule (it used "${broken ?? 'too few words'}"). Write it again without that.`
  }
  return null
}

/**
 * Write up to `count` new drafts for upcoming events in the next ten days,
 * one model call each, stored. Events already drafted (posted, skipped or
 * pending) are never drafted twice.
 */
async function writeXenoDrafts(count: number): Promise<number> {
  // From TOMORROW: a pointer to something already under way is too late to
  // be useful, and posting needs a moment between draft and button.
  const today = sfToday()
  const start = addDays(today, 1)
  const horizon = addDays(today, 10)
  const { data, error } = await db()
    .from('vendor_events')
    .select('id, member_id, title, event_date, end_date, location, poster_image_url, source_id, event_url, neighborhood, lat, lng, description')
    .eq('active', true)
    .not('poster_image_url', 'is', null)
    .gte('event_date', start)
    .lte('event_date', horizon)
    .order('event_date', { ascending: true })
    .limit(300)
  if (error) throw new Error(`events: ${error.message}`)

  const { data: done } = await db().from('feed_items').select('external_uid').eq('source_id', 'xeno_draft')
  const drafted = new Set((done ?? []).map((r) => r.external_uid as string))

  // One per venue, so a batch is not six nights at the same hall.
  const seenVenue = new Set<string>()
  const picks: EventRow[] = []
  for (const e of (data ?? []) as EventRow[]) {
    if (picks.length >= count) break
    if (!e.title || drafted.has(e.id)) continue
    if (e.source_id && RECAP_SKIP_SOURCES.has(e.source_id)) continue
    if (isHiddenMember(e.member_id)) continue
    const v = (venueOf(e.location) ?? e.id).toLowerCase()
    if (seenVenue.has(v)) continue
    seenVenue.add(v)
    picks.push(e)
  }

  let written = 0
  for (const e of picks) {
    let body: string | null = null
    try {
      body = await draftText(e)
    } catch (err) {
      console.error('feed-items: draft failed', e.id, err)
    }
    if (!body) continue
    const { error: insErr } = await db().from('feed_items').upsert(
      {
        layer: 'event',
        account: 'xeno',
        status: 'draft',
        title: cleanTitle(e.title ?? ''),
        body,
        image_url: e.poster_image_url,
        link_url: e.event_url,
        event_id: e.id,
        event_date: e.event_date?.slice(0, 10) ?? null,
        venue: venueOf(e.location),
        neighborhood: e.neighborhood,
        lat: e.lat,
        lng: e.lng,
        source_id: 'xeno_draft',
        external_uid: e.id,
      },
      { onConflict: 'source_id,external_uid', ignoreDuplicates: true },
    )
    if (!insErr) written++
  }
  return written
}

// ── Admin ───────────────────────────────────────────────────────────────────

export interface FeedSeedStatus {
  paused: boolean
  liveNow: number
  scheduled: number
  drafts: FeedItemRow[]
}

export async function feedSeedStatus(): Promise<FeedSeedStatus> {
  const now = new Date().toISOString()
  const base = () => db().from('feed_items').select('id', { count: 'exact', head: true }).eq('account', 'whatslocal').eq('status', 'live')
  const [live, scheduled, hidden, drafts] = await Promise.all([
    base().is('hidden_at', null).lte('published_at', now).or(`expires_at.is.null,expires_at.gt.${now}`),
    base().is('hidden_at', null).gt('published_at', now),
    base().not('hidden_at', 'is', null),
    db().from('feed_items').select('*').eq('account', 'xeno').eq('status', 'draft').order('event_date', { ascending: true }),
  ])
  return {
    // Paused = every WhatsLocal row is hidden (and there is at least one).
    paused: (hidden.count ?? 0) > 0 && (live.count ?? 0) === 0 && (scheduled.count ?? 0) === 0,
    liveNow: live.count ?? 0,
    scheduled: scheduled.count ?? 0,
    drafts: (drafts.data ?? []) as FeedItemRow[],
  }
}

/** `drafts` new Xeno drafts. Safe to re-run. */
export async function generateFeedItems(opts: { drafts: number }): Promise<{ drafts: number }> {
  const drafts = opts.drafts > 0 ? await writeXenoDrafts(opts.drafts) : 0
  return { drafts }
}

/** The no-restart kill switch: hide (or un-hide) every WhatsLocal item. */
export async function setFeedItemsPaused(paused: boolean): Promise<void> {
  const q = db().from('feed_items').update({ hidden_at: paused ? new Date().toISOString() : null }).eq('account', 'whatslocal')
  const { error } = paused ? await q.is('hidden_at', null) : await q.not('hidden_at', 'is', null)
  if (error) throw new Error(error.message)
  invalidateFeedItems()
}

export async function getDraft(id: string): Promise<FeedItemRow | null> {
  const { data } = await db().from('feed_items').select('*').eq('id', id).eq('account', 'xeno').maybeSingle()
  return (data as FeedItemRow | null) ?? null
}

export async function markDraft(
  id: string,
  status: 'posted' | 'skipped',
  by: string,
  extra?: { body?: string; postId?: string },
): Promise<void> {
  const { error } = await db()
    .from('feed_items')
    .update({
      status,
      reviewed_at: new Date().toISOString(),
      reviewed_by: by,
      ...(extra?.body ? { body: extra.body } : {}),
      ...(extra?.postId ? { post_id: extra.postId } : {}),
    })
    .eq('id', id)
    .eq('status', 'draft')
  if (error) throw new Error(error.message)
}
