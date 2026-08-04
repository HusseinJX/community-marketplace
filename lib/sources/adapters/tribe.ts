// WordPress + "The Events Calendar" (Modern Tribe).
//
// The single highest-value pattern found: the plugin is ubiquitous on nonprofit
// and venue sites and exposes a paginated REST API with everything we need —
// including `cost`, which is the only place any source directly tells us an
// event is free. Verified on Fort Mason (1,663 events), Gardens of Golden Gate
// Park, and Yerba Buena Gardens Festival.
//
// A parallel `/events/?ical=1` export also exists but is capped and thinner, so
// the JSON API is preferred and ICS is only a fallback.

import { fetchJson, toText, decodeEntities } from '../fetch'
import type { ScrapedEvent, SourceDef } from '../types'

interface TribeTerm { name?: string }
interface TribeEvent {
  id?: number
  title?: string
  description?: string
  excerpt?: string
  url?: string
  start_date?: string // "2026-08-02 18:30:00" — already site-local
  end_date?: string
  all_day?: boolean
  cost?: string
  image?: { url?: string } | false
  venue?: { venue?: string; address?: string; city?: string } | unknown[]
  categories?: TribeTerm[]
  tags?: TribeTerm[]
}
interface TribeResponse {
  events?: TribeEvent[]
  total?: number
  total_pages?: number
}

/** "Free", "Free–$10", "$0" all mean free; "" means the source didn't say. */
function readCost(cost?: string): boolean | null {
  if (!cost) return null
  const c = cost.trim().toLowerCase()
  if (!c) return null
  if (c === 'free' || c === '0' || c === '$0') return true
  if (c.startsWith('free')) return true
  return false
}

function splitLocal(s?: string): { date: string | null; time: string | null } {
  const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2})/.exec(s ?? '')
  if (!m) return { date: (s ?? '').slice(0, 10) || null, time: null }
  return { date: m[1], time: `${m[2]}:${m[3]}` }
}

export async function scrapeTribe(src: SourceDef): Promise<ScrapedEvent[]> {
  const base = String(src.config.base).replace(/\/$/, '')
  const perPage = Number(src.config.perPage ?? 50)
  const maxPages = Number(src.config.maxPages ?? 6)
  const days = src.windowDays ?? 60

  const start = new Date()
  const end = new Date(Date.now() + days * 864e5)
  const fmt = (d: Date) => d.toISOString().slice(0, 10)

  const out: ScrapedEvent[] = []
  for (let page = 1; page <= maxPages; page++) {
    const url =
      `${base}/wp-json/tribe/events/v1/events` +
      `?per_page=${perPage}&page=${page}&start_date=${fmt(start)}&end_date=${fmt(end)}`
    let res: TribeResponse
    try {
      res = await fetchJson<TribeResponse>(url, { timeoutMs: 25_000 })
    } catch {
      break // a 404 past the last page is how this API signals "done"
    }
    const events = res.events ?? []
    if (!events.length) break

    for (const e of events) {
      const s = splitLocal(e.start_date)
      const en = splitLocal(e.end_date)
      if (!s.date) continue
      const venue = !Array.isArray(e.venue) ? e.venue : undefined
      const image = e.image && typeof e.image === 'object' ? e.image.url ?? null : null

      out.push({
        uid: `${src.id}:${e.id ?? e.url}`,
        sourceId: src.id,
        sourceLabel: src.label,
        title: decodeEntities(e.title ?? '').trim(),
        date: s.date,
        // Tribe repeats a multi-day event's span on every row; only keep it when
        // the event genuinely spans more than one day.
        endDate: en.date && en.date !== s.date ? en.date : null,
        start: e.all_day ? null : s.time,
        end: e.all_day ? null : en.time,
        venue: venue?.venue ?? null,
        location: [venue?.venue, venue?.address, venue?.city].filter(Boolean).join(', ') || null,
        description: (toText(e.excerpt) || toText(e.description)).slice(0, 400) || null,
        url: e.url ?? base,
        imageUrl: image,
        // The plugin has no visibility field — anything on a public calendar is
        // assumed public, which is weaker than SFPL's explicit CLASS:PUBLIC.
        access: 'unknown',
        tags: [...(e.categories ?? []), ...(e.tags ?? [])]
          .map((t) => t?.name)
          .filter((n): n is string => Boolean(n))
          .slice(0, 6),
        free: readCost(e.cost),
        lat: null,
        lng: null,
        geoVia: null,
        neighborhood: null,
      })
    }
    if (res.total_pages && page >= res.total_pages) break
  }
  return out
}
