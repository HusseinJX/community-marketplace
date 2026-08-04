// Scraped events → Supabase.
//
// The one piece the pipeline never had: everything upstream produced a
// ScrapedEvent in memory, and persistDrafts() was an explicit no-op. This is
// where a scrape becomes something a person can see.
//
// Scraped events live in `vendor_events` alongside in-app organizer events
// rather than in a table of their own, so the feed, the event page, the map and
// RSVP all work on them without a second code path. What separates them is
// `source_id`: NULL means a human made it, non-NULL means we harvested it.

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { SOURCES, byId } from './registry'
import type { ScrapedEvent } from './types'
import type { EventAudience } from '@/lib/reco/audience'
import { sfToday } from '@/lib/sf-date'

// LAZY on purpose. Trigger.dev indexes task files by importing them, and that
// import happens before the environment is populated — a client built at module
// scope throws "supabaseUrl is required" and fails the whole deploy. Same
// lesson as the connector's lazily-initialised OpenAI clients.
//
// Service-role preferred (this runs headless, and RLS was hardened in
// 20260708120000); anon is a working fallback since vendor_events grants it.
let _client: SupabaseClient | null = null
function db(): SupabaseClient {
  if (_client) return _client
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('SUPABASE_URL / key not set — cannot persist scraped events')
  _client = createClient(url, key)
  return _client
}

/**
 * Synthetic host id for a scraped event.
 *
 * `member_id` is NOT NULL and a scraped event has no business behind it, so it
 * carries its SOURCE as the host — 'source:sfpl'. Deliberately not a real
 * member id: nothing should be able to mistake a harvested calendar for a
 * claimed business, and the prefix makes that check a substring away. UI that
 * would link to /members/{id} must skip these (see EventFeedCard).
 */
export const hostIdFor = (sourceId: string) => `source:${sourceId}`

/** True for a host id minted by the scraper rather than a real member. */
export const isScrapedHost = (memberId: string | null | undefined) =>
  !!memberId && memberId.startsWith('source:')

/**
 * Should this source's events publish straight to the feed?
 *
 * The nine structured sources read declared data — an ICS feed, a JSON API,
 * schema.org markup — where a parse either works or throws. The 'recipe'
 * pattern is hand-written CSS selectors against markup nobody promised us, so
 * it is the one place a silent mis-parse can produce plausible-looking garbage.
 * That source alone lands as drafts for review.
 */
export function autoPublishes(sourceId: string): boolean {
  return byId(sourceId)?.pattern !== 'recipe'
}

/** Longest description we keep. Full text lives at `event_url`. */
const MAX_DESC = 2000

/**
 * `event_time` is free text that goes straight onto the card, and every event
 * made in-app is written in 12-hour form ("6:30 PM"). Scrapers produce 24-hour
 * ("13:00"), so without this a harvested event is visibly the odd one out in a
 * feed it shares with community events.
 */
function displayTime(start: string | null, end: string | null): string | null {
  const one = (t: string | null) => {
    if (!t) return null
    const m = /^(\d{1,2}):(\d{2})/.exec(t)
    if (!m) return t // not a shape we recognise — pass it through untouched
    const h = Number(m[1])
    if (h > 23) return t
    const suffix = h < 12 ? 'AM' : 'PM'
    return `${h % 12 === 0 ? 12 : h % 12}:${m[2]} ${suffix}`
  }
  const a = one(start)
  const b = one(end)
  if (!a) return null
  return b && b !== a ? `${a} – ${b}` : a
}

/**
 * SFPL prefixes every title with its internal programme taxonomy — "Book Club:
 * Check 'em Out", "Tutorial: Book a Librarian". Useful in a library catalogue,
 * noise in a community feed where the category is already obvious from context.
 * Stripped only when a real title survives it.
 */
const TITLE_PREFIX = /^(Book Club|Dialogue|Activity|Services|Tutorial|Workshop|Class|Program|Event|Talk|Film|Reading|Lecture|Meeting|Exhibit|Exhibition):\s*/i

function cleanTitle(raw: string): string {
  const stripped = raw.replace(TITLE_PREFIX, '').trim()
  return stripped.length >= 3 ? stripped : raw.trim()
}

function toRow(e: ScrapedEvent) {
  return {
    member_id: hostIdFor(e.sourceId),
    member_name: e.sourceLabel,
    title: cleanTitle(e.title).slice(0, 300),
    description: e.description?.trim().slice(0, MAX_DESC) || null,
    event_date: e.date,
    end_date: e.endDate,
    event_time: displayTime(e.start, e.end),
    location: e.location ?? e.venue ?? null,
    city: 'San Francisco',
    neighborhood: e.neighborhood,
    lat: e.lat,
    lng: e.lng,
    poster_image_url: e.imageUrl,
    source: 'scraped',
    source_id: e.sourceId,
    external_uid: e.uid,
    event_url: e.url,
    // Facts the parse already produced. These used to be dropped on the floor,
    // which is why a feed built on this data could not offer a single filter.
    tags: e.tags.length ? e.tags : null,
    free: e.free,
    access: e.access,
    updated_at: new Date().toISOString(),
  }
}

/**
 * Attach audience labels to rows already in the table.
 *
 * Separate from the upsert on purpose: labelling costs money and scraping does
 * not, so a re-scrape must never re-label. Keyed on (source_id, external_uid),
 * the same pair the upsert dedupes on.
 */
export async function persistAudience(
  labels: Record<string, EventAudience & { sourceId: string; uid: string }>,
  opts: { log?: (s: string) => void } = {}
): Promise<{ updated: number; failed: number }> {
  let updated = 0
  let failed = 0

  for (const l of Object.values(labels)) {
    const { sourceId, uid, topics, energy, idealAudience, ...rest } = l
    const { error, data } = await db()
      .from('vendor_events')
      .update({
        topics: topics?.length ? topics : null,
        energy,
        ideal_audience: idealAudience,
        audience: rest,
      })
      .eq('source_id', sourceId)
      .eq('external_uid', uid)
      .select('id')

    if (error) {
      failed++
      opts.log?.(`  ${sourceId}:${uid} — ${error.message}`)
      continue
    }
    updated += data?.length ?? 0
  }

  return { updated, failed }
}

/** Scraped events that have never been labelled — the only ones worth paying for. */
export async function unlabelledScraped(limit = 2000) {
  const { data, error } = await db()
    .from('vendor_events')
    .select('id, source_id, external_uid, title, description, tags, location, event_time, free')
    .not('source_id', 'is', null)
    .is('topics', null)
    .limit(limit)
  if (error) throw new Error(`could not read unlabelled events: ${error.message}`)
  return data ?? []
}

export interface PersistResult {
  written: number
  published: number
  drafted: number
  failed: number
  errors: string[]
}

type Row = ReturnType<typeof toRow> & { active?: boolean }

/** Upsert rows in chunks, accumulating failures rather than aborting the sweep. */
async function upsertRows(rows: Row[], out: PersistResult, log?: (s: string) => void) {
  const CHUNK = 250
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK)
    const { error, data } = await db()
      .from('vendor_events')
      .upsert(chunk, { onConflict: 'source_id,external_uid' })
      .select('id, active')

    if (error) {
      out.failed += chunk.length
      out.errors.push(error.message)
      log?.(`  chunk failed: ${error.message}`)
      continue
    }

    out.written += data?.length ?? chunk.length
    for (const r of data ?? []) (r.active ? out.published++ : out.drafted++)
  }
}

/**
 * Upsert a batch of scraped events.
 *
 * Idempotent on (source_id, external_uid): re-running a scrape refreshes rows
 * in place rather than duplicating them, which is what makes a weekly sweep
 * safe to run forever.
 *
 * `active` is handled separately from every other column, and that asymmetry is
 * the point. Upsert overwrites whatever it is given, so including `active` in
 * the update set would make each sweep undo a reviewer's decision — a
 * downtownsf event approved on Monday would silently revert to a draft on
 * Tuesday. So the review sources set `active` only on INSERT, and re-scrapes
 * refresh their content while leaving the publish decision alone.
 */
export async function persistScraped(
  events: ScrapedEvent[],
  opts: { log?: (s: string) => void } = {}
): Promise<PersistResult> {
  const out: PersistResult = { written: 0, published: 0, drafted: 0, failed: 0, errors: [] }
  if (!events.length) return out

  const auto = events.filter((e) => autoPublishes(e.sourceId))
  const review = events.filter((e) => !autoPublishes(e.sourceId))

  // Structured sources: the scraper owns the publish state outright.
  if (auto.length) {
    await upsertRows(auto.map((e) => ({ ...toRow(e), active: true })), out, opts.log)
  }

  // Review sources: find which rows already exist, so `active` is set on the
  // new ones and left untouched on the rest.
  if (review.length) {
    const sourceIds = [...new Set(review.map((e) => e.sourceId))]
    const { data: existing, error } = await db()
      .from('vendor_events')
      .select('external_uid')
      .in('source_id', sourceIds)

    if (error) {
      // Cannot tell new from existing — the safe reading is "all existing", so
      // we refresh content and never flip a publish state we might not own.
      out.errors.push(`could not read existing review rows: ${error.message}`)
      opts.log?.(`  ${error.message} — refreshing review rows without touching active`)
      await upsertRows(review.map(toRow), out, opts.log)
    } else {
      const seen = new Set((existing ?? []).map((r) => r.external_uid))
      const fresh = review.filter((e) => !seen.has(e.uid))
      const known = review.filter((e) => seen.has(e.uid))
      if (fresh.length) {
        await upsertRows(fresh.map((e) => ({ ...toRow(e), active: false })), out, opts.log)
      }
      if (known.length) await upsertRows(known.map(toRow), out, opts.log)
    }
  }

  return out
}

/**
 * Remove scraped events that have finished.
 *
 * Only ever touches rows this scraper owns (`source_id IS NOT NULL`) — an
 * in-app organizer event is somebody's work and is never deleted by a sweep.
 * Without this the table grows without bound, since a source stops listing an
 * event once it is over and the upsert would leave the last copy behind forever.
 */
export async function pruneFinished(opts: { log?: (s: string) => void } = {}): Promise<number> {
  // City-local: deleting on a UTC date would bin events that are still to
  // come this evening in San Francisco.
  const today = sfToday()

  // Multi-day events are judged on their end date, matching isCurrent() in the
  // runner — otherwise a running exhibition gets deleted the day after it opens.
  const { data, error } = await db()
    .from('vendor_events')
    .delete()
    .not('source_id', 'is', null)
    .or(`end_date.lt.${today},and(end_date.is.null,event_date.lt.${today})`)
    .select('id')

  if (error) {
    opts.log?.(`  prune failed: ${error.message}`)
    return 0
  }
  return data?.length ?? 0
}

/**
 * Kill switch: hide (or restore) every scraped event at once.
 *
 * The feed is served to a live App Store app that cannot be rolled back, so
 * there has to be a way to pull harvested content in one statement without
 * shipping a build. Flips `active` only on rows the scraper owns — in-app
 * organizer events are never touched.
 */
export async function setScrapedVisibility(
  visible: boolean,
  opts: { sourceId?: string } = {}
): Promise<number> {
  let q = db().from('vendor_events').update({ active: visible }).not('source_id', 'is', null)
  if (opts.sourceId) q = q.eq('source_id', opts.sourceId)
  const { data, error } = await q.select('id')
  if (error) throw new Error(`visibility flip failed: ${error.message}`)
  return data?.length ?? 0
}

/** Per-source counts of what is currently in the table — for the sweep report. */
export async function scrapedCounts(): Promise<Record<string, { live: number; draft: number }>> {
  const { data, error } = await db()
    .from('vendor_events')
    .select('source_id, active')
    .not('source_id', 'is', null)

  const out: Record<string, { live: number; draft: number }> = {}
  if (error || !data) return out
  for (const s of SOURCES) out[s.id] = { live: 0, draft: 0 }
  for (const r of data as { source_id: string; active: boolean }[]) {
    out[r.source_id] ??= { live: 0, draft: 0 }
    if (r.active) out[r.source_id].live++
    else out[r.source_id].draft++
  }
  return out
}
