// Squarespace — append ?format=json to ANY collection URL.
//
// Works on every Squarespace site, which makes it one of the widest-reach
// patterns available: no scraping, no selectors, nothing to drift.
//
// Two gotchas, both learned the hard way:
//   • Event collections put events in `upcoming` / `past`, NOT `items`
//     (`items` is empty for this collection type).
//   • `?format=ical` only works on true calendar collections and silently
//     returns the HTML page otherwise — do not rely on it.

import { fetchJson, toText } from '../fetch'
import type { ScrapedEvent, SourceDef } from '../types'

interface SqspLocation { addressTitle?: string; addressLine1?: string; addressLine2?: string }
interface SqspItem {
  id?: string
  title?: string
  fullUrl?: string
  body?: string
  excerpt?: string
  startDate?: number // epoch ms
  endDate?: number
  location?: SqspLocation
  categories?: string[]
  tags?: string[]
  assetUrl?: string
}
interface SqspResponse { upcoming?: SqspItem[]; past?: SqspItem[]; items?: SqspItem[] }

function parts(ms: number, tz: string) {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
  const p = Object.fromEntries(f.formatToParts(new Date(ms)).map((x) => [x.type, x.value]))
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour === '24' ? '00' : p.hour}:${p.minute}` }
}

export async function scrapeSquarespace(src: SourceDef): Promise<ScrapedEvent[]> {
  const base = String(src.config.base).replace(/\/$/, '')
  const path = String(src.config.collection ?? '/events')
  const tz = String(src.config.timezone ?? 'America/Los_Angeles')

  const res = await fetchJson<SqspResponse>(`${base}${path}?format=json`, { timeoutMs: 25_000 })
  // `past` is deliberately ignored — only `upcoming` is real forward content.
  const items = res.upcoming ?? res.items ?? []

  return items.flatMap((it) => {
    if (!it.startDate || !it.title) return []
    const s = parts(it.startDate, tz)
    const e = it.endDate ? parts(it.endDate, tz) : null
    const L = it.location ?? {}
    return [{
      uid: `${src.id}:${it.id ?? it.fullUrl}`,
      sourceId: src.id,
      sourceLabel: src.label,
      title: it.title.trim(),
      date: s.date,
      endDate: e && e.date !== s.date ? e.date : null,
      start: s.time,
      end: e?.time ?? null,
      venue: L.addressTitle ?? null,
      location: [L.addressTitle, L.addressLine1, L.addressLine2].filter(Boolean).join(', ') || null,
      description: (toText(it.body) || toText(it.excerpt)).slice(0, 400) || null,
      url: base + (it.fullUrl ?? ''),
      imageUrl: it.assetUrl ?? null,
      access: 'unknown',
      tags: [...(it.categories ?? []), ...(it.tags ?? [])].slice(0, 6),
      free: null,
      lat: null,
      lng: null,
      geoVia: null,
      neighborhood: null,
    }]
  })
}
