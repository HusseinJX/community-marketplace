// The review queue for scraped event drafts.
//
// Only recipe-pattern sources produce drafts (see autoPublishes) — those parsed
// with hand-written CSS selectors against markup nobody promised us, where a
// silent mis-parse yields plausible-looking garbage rather than an error. Every
// other source declares its data and publishes straight through.
//
// Scoped by SOURCE, never by `active` alone. The kill switch flips `active` off
// across every scraped row, and a queue defined as "active = false" would then
// present all ~800 published events as though they were awaiting review.

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { SOURCES, byId } from '@/lib/sources/registry'
import { autoPublishes } from '@/lib/sources/persist'
import { sfToday } from '@/lib/sf-date'

let _client: SupabaseClient | null = null
function db(): SupabaseClient {
  if (_client) return _client
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('SUPABASE_URL / key not set — cannot read the review queue')
  _client = createClient(url, key)
  return _client
}

/** Sources whose events need a human before they reach the feed. */
export function reviewSourceIds(): string[] {
  return SOURCES.filter((s) => !autoPublishes(s.id)).map((s) => s.id)
}

export interface DraftEvent {
  id: string
  title: string
  description: string | null
  date: string | null
  /** Last day, for multi-day runs. Null for a one-off. */
  endDate: string | null
  time: string | null
  location: string | null
  image: string | null
  url: string | null
  sourceId: string | null
  sourceLabel: string
}

/**
 * Drafts nobody has ruled on yet, soonest first.
 *
 * Finished events are left out: approving one publishes it into a feed that
 * prunes it on the next sweep, so the decision is work with no outcome. The
 * test mirrors pruneFinished() exactly — judged on the END date where there is
 * one, so a months-long exhibition that opened in June is still a live
 * decision, while a one-night thing in March is not.
 *
 * City-local, never UTC: after 5pm Pacific a UTC "today" would start hiding
 * drafts for events happening that same evening.
 */
export async function pendingDrafts(limit = 200): Promise<DraftEvent[]> {
  const sources = reviewSourceIds()
  if (!sources.length) return []
  const today = sfToday()

  const { data, error } = await db()
    .from('vendor_events')
    .select('id, title, description, event_date, end_date, event_time, location, poster_image_url, event_url, source_id')
    .in('source_id', sources)
    .eq('active', false)
    .is('reviewed_at', null)
    .or(`end_date.gte.${today},and(end_date.is.null,event_date.gte.${today})`)
    .order('event_date', { ascending: true })
    .limit(limit)

  if (error) throw new Error(`could not read the review queue: ${error.message}`)

  return (data ?? []).map((r) => ({
    id: r.id as string,
    title: r.title as string,
    description: (r.description as string | null) ?? null,
    date: (r.event_date as string | null) ?? null,
    endDate: (r.end_date as string | null) ?? null,
    time: (r.event_time as string | null) ?? null,
    location: (r.location as string | null) ?? null,
    image: (r.poster_image_url as string | null) ?? null,
    url: (r.event_url as string | null) ?? null,
    sourceId: (r.source_id as string | null) ?? null,
    sourceLabel: byId((r.source_id as string) ?? '')?.label ?? (r.source_id as string) ?? 'Unknown',
  }))
}

/**
 * Record a decision on some drafts.
 *
 * Both outcomes stamp `reviewed_at`, which is what makes a rejection stick —
 * the next sweep refreshes the row's content but leaves `active` and
 * `reviewed_at` alone, so the same event is never re-offered.
 *
 * Constrained to review sources and to rows still pending, so a stale tab
 * cannot unpublish a live event by replaying an old id.
 */
export async function decideDrafts(ids: string[], approve: boolean): Promise<number> {
  if (!ids.length) return 0
  const sources = reviewSourceIds()
  if (!sources.length) return 0

  const { data, error } = await db()
    .from('vendor_events')
    .update({ active: approve, reviewed_at: new Date().toISOString() })
    .in('id', ids)
    .in('source_id', sources)
    .eq('active', false)
    .is('reviewed_at', null)
    .select('id')

  if (error) throw new Error(`could not save the decision: ${error.message}`)
  return data?.length ?? 0
}

/**
 * How many drafts are waiting — for a badge, without shipping the rows.
 * Same conditions as pendingDrafts(), or the badge promises work the list
 * does not show.
 */
export async function pendingDraftCount(): Promise<number> {
  const sources = reviewSourceIds()
  if (!sources.length) return 0
  const today = sfToday()
  const { count, error } = await db()
    .from('vendor_events')
    .select('*', { count: 'exact', head: true })
    .in('source_id', sources)
    .eq('active', false)
    .is('reviewed_at', null)
    .or(`end_date.gte.${today},and(end_date.is.null,event_date.gte.${today})`)
  if (error) return 0
  return count ?? 0
}
