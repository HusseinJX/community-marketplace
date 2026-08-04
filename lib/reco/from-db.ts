// Bridge: stored events → the shapes the ranker already speaks.
//
// `rankEvents` was written against ScrapedEvent + EventAudience, and it works —
// it is the code the personalisation demo was built on. Rather than rewrite the
// ranker for a database row, this maps a row back into those shapes, so the
// ranking logic that was actually verified is the ranking logic that ships.

import type { ScrapedEvent } from '@/lib/sources/types'
import type { EventAudience, Energy, Topic } from './audience'

/** The columns the feed reads. Keep in step with `FEED_COLUMNS` below. */
export interface EventRow {
  id: string
  source_id: string | null
  external_uid: string | null
  member_name: string | null
  title: string
  description: string | null
  event_date: string | null
  end_date: string | null
  event_time: string | null
  location: string | null
  neighborhood: string | null
  lat: number | null
  lng: number | null
  poster_image_url: string | null
  event_url: string | null
  tags: string[] | null
  free: boolean | null
  access: string | null
  topics: string[] | null
  energy: string | null
  ideal_audience: string | null
  audience: Record<string, unknown> | null
}

export const FEED_COLUMNS =
  'id, source_id, external_uid, member_name, title, description, event_date, end_date, ' +
  'event_time, location, neighborhood, lat, lng, poster_image_url, event_url, ' +
  'tags, free, access, topics, energy, ideal_audience, audience'

/**
 * Coerce a stored date to ISO `YYYY-MM-DD`.
 *
 * Scraped events always carry ISO. In-app events do NOT: `event_date` is free
 * text and older rows hold things like "Friday, Jul 25". That breaks every
 * date comparison in the feed — the SQL window compares strings, and "Friday…"
 * sorts after any "2026-…", so a July event survived an "on or after today"
 * filter and then landed at the very bottom under its own raw header.
 *
 * The year is missing from that format, so the current one is assumed. That is
 * wrong for a "Jan 5" written in December; it is right for every other case,
 * and being a day out beats being seven months out.
 *
 * Returns null when it cannot be read at all — the caller drops those rather
 * than inventing a date for them.
 */
export function normalizeDate(raw: string | null): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10)

  for (const attempt of [trimmed, `${trimmed} ${new Date().getFullYear()}`]) {
    const ms = Date.parse(attempt)
    if (!Number.isNaN(ms)) {
      const d = new Date(ms)
      // Built from local parts, not toISOString — a date parsed as local
      // midnight would otherwise shift back a day in any western timezone.
      const p = (n: number) => String(n).padStart(2, '0')
      return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
    }
  }
  return null
}

/**
 * The ranker keys everything off `uid`, so the row id is used as the uid.
 *
 * Deliberately NOT `external_uid`: in-app organiser events have none, and they
 * belong in a personalised feed exactly as much as harvested ones do. The row
 * id is the only identifier every event is guaranteed to have.
 */
export function rowToEvent(r: EventRow): ScrapedEvent {
  return {
    uid: r.id,
    sourceId: r.source_id ?? 'community',
    sourceLabel: r.member_name ?? 'Community',
    title: r.title,
    date: normalizeDate(r.event_date) ?? '',
    endDate: normalizeDate(r.end_date),
    start: r.event_time,
    end: null,
    venue: r.location,
    location: r.location,
    description: r.description,
    url: r.event_url ?? `/events/${r.id}`,
    imageUrl: r.poster_image_url,
    access: (r.access as ScrapedEvent['access']) ?? 'unknown',
    tags: r.tags ?? [],
    free: r.free,
    lat: r.lat,
    lng: r.lng,
    geoVia: null,
    neighborhood: r.neighborhood,
  }
}

/**
 * Rebuild EventAudience from the split storage (topics/energy/ideal_audience as
 * columns for SQL filtering, the rest in jsonb).
 *
 * Returns undefined for an unlabelled event rather than an empty object — the
 * ranker treats a missing audience as "unknown", which lets it through soft
 * ranking but never lets it pass a hard filter it cannot prove it meets.
 */
export function rowToAudience(r: EventRow): EventAudience | undefined {
  if (!r.topics && !r.energy && !r.ideal_audience && !r.audience) return undefined
  const a = (r.audience ?? {}) as Partial<EventAudience>
  return {
    topics: (r.topics ?? []) as Topic[],
    energy: (r.energy as Energy | null) ?? null,
    minAge: a.minAge ?? null,
    maxAge: a.maxAge ?? null,
    kidsWelcome: a.kidsWelcome ?? null,
    adultsOnly: a.adultsOnly ?? null,
    format: a.format ?? null,
    timeOfDay: a.timeOfDay ?? null,
    outdoor: a.outdoor ?? null,
    newcomerFriendly: a.newcomerFriendly ?? null,
    idealAudience: r.ideal_audience ?? null,
  }
}

/** Both maps in one pass, keyed the way rankEvents expects. */
export function prepare(
  rows: EventRow[],
  opts: { from?: string } = {}
): { events: ScrapedEvent[]; audience: Record<string, EventAudience> } {
  const events: ScrapedEvent[] = []
  const audience: Record<string, EventAudience> = {}
  const from = opts.from

  for (const r of rows) {
    const e = rowToEvent(r)
    // Re-apply the date window on NORMALISED dates. The SQL filter compares
    // raw strings, which free-text dates defeat — this is where a stale
    // "Friday, Jul 25" actually gets dropped. Undated events are kept: they
    // rank low but a missing date is not evidence of being over.
    if (from && e.date && (e.endDate ?? e.date) < from) continue
    events.push(e)
    const a = rowToAudience(r)
    if (a) audience[r.id] = a
  }
  return { events, audience }
}
