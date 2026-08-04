// Localist — the calendar platform behind most university and large-institution
// event sites (UCSF here; SF State, CCSF and USF are worth probing for it too).
//
// It ships a documented, paginated JSON API at /api/2/events, and uniquely
// carries an explicit `free` boolean, so we never have to infer price.

import { fetchJson, toText } from '../fetch'
import { plausible } from '../geo'
import type { ScrapedEvent, SourceDef } from '../types'

interface LocalistInstance { event_instance?: { id?: number; start?: string; end?: string } }
interface LocalistGeo { latitude?: string; longitude?: string; city?: string; street?: string }
interface LocalistEvent {
  id?: number
  geo?: LocalistGeo
  title?: string
  description_text?: string
  description?: string
  localist_url?: string
  url_path?: string
  photo_url?: string
  location_name?: string
  address?: string
  room_number?: string
  free?: boolean
  event_instances?: LocalistInstance[]
  filters?: Record<string, { name?: string }[]>
  keywords?: string[]
  tags?: string[]
}
interface LocalistResponse {
  events?: { event: LocalistEvent }[]
  page?: { current?: number; total?: number }
}

/** Localist stamps carry a real offset (2026-08-02T18:00:00-07:00) — take it as written. */
function splitOffsetIso(iso?: string): { date: string | null; time: string | null } {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/.exec(iso ?? '')
  return m ? { date: m[1], time: `${m[2]}:${m[3]}` } : { date: null, time: null }
}

export async function scrapeLocalist(src: SourceDef): Promise<ScrapedEvent[]> {
  const base = String(src.config.base).replace(/\/$/, '')
  const days = src.windowDays ?? 30
  const perPage = Number(src.config.perPage ?? 100)
  const maxPages = Number(src.config.maxPages ?? 3)

  const out: ScrapedEvent[] = []
  for (let page = 1; page <= maxPages; page++) {
    const res = await fetchJson<LocalistResponse>(
      `${base}/api/2/events?days=${days}&pp=${perPage}&page=${page}`,
      { timeoutMs: 25_000 }
    )
    const rows = res.events ?? []
    if (!rows.length) break

    for (const { event: e } of rows) {
      const inst = e.event_instances?.[0]?.event_instance
      const s = splitOffsetIso(inst?.start)
      if (!e.title || !s.date) continue
      const en = splitOffsetIso(inst?.end)

      out.push({
        uid: `${src.id}:${e.id ?? inst?.id}`,
        sourceId: src.id,
        sourceLabel: src.label,
        title: e.title.trim(),
        date: s.date,
        endDate: en.date && en.date !== s.date ? en.date : null,
        start: s.time,
        end: en.time,
        venue: e.location_name ?? null,
        location: [e.location_name, e.room_number, e.address].filter(Boolean).join(', ') || null,
        description: (e.description_text ?? toText(e.description)).slice(0, 400) || null,
        url: e.localist_url ?? `${base}/event/${e.url_path ?? ''}`,
        imageUrl: e.photo_url ?? null,
        access: 'unknown',
        tags: [
          ...Object.values(e.filters ?? {}).flat().map((f) => f?.name),
          ...(e.keywords ?? []),
        ].filter((t): t is string => Boolean(t)).slice(0, 6),
        free: typeof e.free === 'boolean' ? e.free : null,
        // Localist publishes coordinates as strings; `plausible` also screens
        // out the integer-truncated junk some platforms emit.
        ...(() => {
          const p = plausible(e.geo?.latitude, e.geo?.longitude)
          return p
            ? { lat: p.lat, lng: p.lng, geoVia: 'native' as const }
            : { lat: null, lng: null, geoVia: null }
        })(),
        neighborhood: null,
      })
    }
    if (res.page?.total && page >= res.page.total) break
  }
  return out
}
