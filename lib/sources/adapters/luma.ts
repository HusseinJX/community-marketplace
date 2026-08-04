// Luma calendars (lu.ma / luma.com).
//
// Two endpoints exist and the JSON API is strictly better than the ICS: it
// carries `visibility` — the access signal the ICS omits entirely — plus a
// structured address and a cover image.
//
// Neither exposes a description: the ICS DESCRIPTION is only a link + address +
// host, and the API's `description` field is null even on the per-event
// endpoint. The blurb therefore comes from the event page's og:description,
// which is truncated by Luma but usable.
//
// The calendar id is discoverable from an embed on the organisation's own site:
//   luma.com/embed/calendar/cal-XXXXXXXX/events

import { fetchJson, fetchText, pooled, decodeEntities } from '../fetch'
import { plausible } from '../geo'
import type { Access, ScrapedEvent, SourceDef } from '../types'

interface LumaGeo {
  address?: string; city?: string; region?: string; full_address?: string
  sublocality?: string // neighbourhood, e.g. "Mission District"
}
interface LumaEvent {
  api_id?: string
  name?: string
  start_at?: string // ISO with offset, e.g. 2026-08-02T20:00:00.000Z
  end_at?: string
  url?: string // slug only
  cover_url?: string
  visibility?: string
  geo_address_info?: LumaGeo
  /** Luma resolves venues through Google, so this is an exact fix. */
  coordinate?: { latitude?: number; longitude?: number }
  timezone?: string
}
interface LumaResponse { entries?: { event: LumaEvent }[] }

/** Luma returns UTC; render in the calendar's own timezone. */
function localParts(iso: string, tz: string): { date: string; time: string } {
  const d = new Date(iso)
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]))
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    time: `${p.hour === '24' ? '00' : p.hour}:${p.minute}`,
  }
}

export async function scrapeLuma(src: SourceDef): Promise<ScrapedEvent[]> {
  const calId = String(src.config.calendarId)
  const tz = String(src.config.timezone ?? 'America/Los_Angeles')
  const limit = Number(src.config.pageLimit ?? 50)

  const res = await fetchJson<LumaResponse>(
    `https://api.lu.ma/calendar/get-items?calendar_api_id=${calId}&period=future&pagination_limit=${limit}`,
    { timeoutMs: 25_000 }
  )

  const events: ScrapedEvent[] = (res.entries ?? []).flatMap(({ event: e }) => {
    if (!e?.start_at || !e.name) return []
    const s = localParts(e.start_at, tz)
    const en = e.end_at ? localParts(e.end_at, tz) : null
    const g = e.geo_address_info ?? {}
    const vis = (e.visibility ?? '').toLowerCase()
    const access: Access = vis === 'public' ? 'public' : vis ? 'private' : 'unknown'

    return [{
      uid: `${src.id}:${e.api_id ?? e.url}`,
      sourceId: src.id,
      sourceLabel: src.label,
      title: e.name.trim(),
      date: s.date,
      endDate: en && en.date !== s.date ? en.date : null,
      start: s.time,
      end: en?.time ?? null,
      venue: g.address ?? null,
      location: g.full_address ?? ([g.address, g.city, g.region].filter(Boolean).join(', ') || null),
      description: null, // filled below
      url: `https://luma.com/${e.url ?? ''}`,
      imageUrl: e.cover_url ?? null,
      access,
      tags: [],
      free: null,
      ...(() => {
        const p = plausible(e.coordinate?.latitude, e.coordinate?.longitude)
        return p
          ? { lat: p.lat, lng: p.lng, geoVia: 'native' as const }
          : { lat: null, lng: null, geoVia: null }
      })(),
      neighborhood: g.sublocality ?? null,
    }]
  })

  // Descriptions exist only as og:description on the event page.
  await pooled(events, async (ev) => {
    const html = await fetchText(ev.url, { timeoutMs: 18_000, retries: 1 })
    const m =
      /<meta[^>]+property="og:description"[^>]+content="([^"]*)"/i.exec(html) ??
      /<meta[^>]+name="description"[^>]+content="([^"]*)"/i.exec(html)
    if (m) ev.description = decodeEntities(m[1]).slice(0, 400)
  }, 5)

  return events
}
