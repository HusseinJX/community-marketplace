// schema.org JSON-LD `Event` — the universal fallback.
//
// This is the most durable extraction path after a real feed: JSON-LD is a
// standard, so unlike CSS selectors it does not drift when a site restyles.
//
// Two shapes are supported:
//   • `listing`  — a page that embeds Event objects directly.
//   • `archive`  — a date-archive index (`/YYYY/MM/DD/`) whose links each point
//                  at an event page carrying its own JSON-LD. This is how
//                  Funcheap works: ~24 curated free events per day.

import { fetchText, pooled, toText, absolute, fullSizeWordPressImage } from '../fetch'
import type { ScrapedEvent, SourceDef } from '../types'

interface LdPlace { name?: string; address?: unknown }
interface LdOffer { price?: string | number; lowPrice?: string | number; availability?: string }
interface LdEvent {
  '@type'?: string | string[]
  name?: string
  description?: string
  startDate?: string
  endDate?: string
  url?: string
  image?: string | string[] | { url?: string }
  location?: LdPlace | LdPlace[]
  offers?: LdOffer | LdOffer[]
  eventAttendanceMode?: string
  isAccessibleForFree?: boolean
}

const EVENT_TYPES = /^(Event|MusicEvent|TheaterEvent|SocialEvent|EducationEvent|ExhibitionEvent|Festival|ScreeningEvent|FoodEvent|ChildrensEvent|SportsEvent|VisualArtsEvent|LiteraryEvent|DanceEvent|ComedyEvent|BusinessEvent)$/

/** Pull every JSON-LD block and flatten @graph / arrays into a flat node list. */
export function extractLdNodes(html: string): Record<string, unknown>[] {
  const nodes: Record<string, unknown>[] = []
  const rx = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  for (const m of html.matchAll(rx)) {
    let parsed: unknown
    try {
      parsed = JSON.parse(m[1].trim())
    } catch {
      continue // malformed JSON-LD is common; skip rather than fail the run
    }
    // Events hide at different depths depending on the site: directly in
    // @graph, or wrapped in a CollectionPage → itemListElement → ListItem →
    // item chain (SOMArts). Walk every container key rather than guessing.
    const NEST = ['@graph', 'itemListElement', 'item', 'mainEntity', 'hasPart', 'subEvent'] as const
    const seen = new Set<unknown>()
    const walk = (v: unknown) => {
      if (Array.isArray(v)) return v.forEach(walk)
      if (!v || typeof v !== 'object' || seen.has(v)) return
      seen.add(v)
      const o = v as Record<string, unknown>
      nodes.push(o)
      for (const k of NEST) if (o[k]) walk(o[k])
    }
    walk(parsed)
  }
  return nodes
}

function isEvent(n: Record<string, unknown>): boolean {
  const t = n['@type']
  const types = Array.isArray(t) ? t : [t]
  return types.some((x) => typeof x === 'string' && EVENT_TYPES.test(x))
}

function placeName(loc: LdEvent['location']): { venue: string | null; full: string | null } {
  const p = Array.isArray(loc) ? loc[0] : loc
  if (!p) return { venue: null, full: null }
  const name = typeof p === 'string' ? p : p.name ?? null
  const addr = typeof p === 'object' && p.address
    ? typeof p.address === 'string'
      ? p.address
      : Object.values(p.address as Record<string, unknown>)
          .filter((v) => typeof v === 'string' && !String(v).startsWith('http'))
          .join(', ')
    : null
  return { venue: name, full: [name, addr].filter(Boolean).join(', ') || null }
}

function freeFrom(e: LdEvent): boolean | null {
  if (typeof e.isAccessibleForFree === 'boolean') return e.isAccessibleForFree
  const o = Array.isArray(e.offers) ? e.offers[0] : e.offers
  const p = o?.price ?? o?.lowPrice
  if (p === undefined || p === null || p === '') return null
  return Number(p) === 0
}

function splitIso(iso?: string): { date: string | null; time: string | null } {
  if (!iso) return { date: null, time: null }
  const m = /^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(iso)
  return m ? { date: m[1], time: m[2] ? `${m[2]}:${m[3]}` : null } : { date: null, time: null }
}

function toEvent(node: Record<string, unknown>, src: SourceDef, pageUrl: string): ScrapedEvent | null {
  const e = node as LdEvent
  const s = splitIso(e.startDate)
  if (!e.name || !s.date) return null
  const en = splitIso(e.endDate)
  const { venue, full } = placeName(e.location)
  const img = typeof e.image === 'string' ? e.image
    : Array.isArray(e.image) ? e.image[0]
    : e.image && typeof e.image === 'object' ? e.image.url ?? null
    : null

  return {
    uid: `${src.id}:${e.url ?? pageUrl}:${s.date}`,
    sourceId: src.id,
    sourceLabel: src.label,
    title: toText(String(e.name)).trim(),
    date: s.date,
    endDate: en.date && en.date !== s.date ? en.date : null,
    start: s.time,
    end: en.time,
    venue,
    location: full,
    description: toText(e.description).slice(0, 400) || null,
    url: e.url ?? pageUrl,
    imageUrl: img ?? null,
    access: 'unknown',
    tags: [],
    free: freeFrom(e),
    lat: null,
    lng: null,
    geoVia: null,
    neighborhood: null,
  }
}

/**
 * Replace every WordPress derivative with its original, in parallel.
 *
 * Runs once over the finished list rather than inside toEvent(), which is sync
 * and called from two places — one pass here beats threading async through both.
 */
async function upsizeImages(events: ScrapedEvent[]): Promise<ScrapedEvent[]> {
  const urls = [...new Set(events.map((e) => e.imageUrl).filter((u): u is string => !!u))]
  const resolved = new Map<string, string | null>()
  // Deduped: the same poster is reused across an event's repeat dates, and one
  // HEAD per distinct image is the difference between 10 requests and 220.
  await pooled(urls, async (u) => {
    resolved.set(u, await fullSizeWordPressImage(u))
    return null
  }, 8)
  return events.map((e) =>
    e.imageUrl ? { ...e, imageUrl: resolved.get(e.imageUrl) ?? e.imageUrl } : e,
  )
}

export async function scrapeJsonLd(src: SourceDef): Promise<ScrapedEvent[]> {
  const mode = String(src.config.mode ?? 'listing')
  const base = String(src.config.base).replace(/\/$/, '')
  const browserUa = Boolean(src.config.browserUa)

  if (mode === 'listing') {
    const url = base + String(src.config.path ?? '/events')
    const html = await fetchText(url, { timeoutMs: 25_000, browserUa })
    return upsizeImages(
      extractLdNodes(html).filter(isEvent)
        .map((n) => toEvent(n, src, url))
        .filter((e): e is ScrapedEvent => e !== null),
    )
  }

  // archive mode: walk /YYYY/MM/DD/ indexes, then each linked event page.
  const days = src.windowDays ?? 7
  const linkRx = new RegExp(String(src.config.linkPattern ?? `href="(${base}/[a-z0-9][a-z0-9-]{8,}/)"`), 'g')

  const dayUrls = Array.from({ length: days }, (_, i) => {
    const d = new Date(Date.now() + i * 864e5)
    return `${base}/${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/`
  })

  const linkSets = await pooled(dayUrls, async (u) => {
    const html = await fetchText(u, { timeoutMs: 22_000, browserUa, retries: 1 })
    return [...new Set([...html.matchAll(linkRx)].map((m) => absolute(u, m[1])))]
  }, 4)

  const links = [...new Set(linkSets.filter(Boolean).flat() as string[])]
    .slice(0, Number(src.config.maxEvents ?? 250))

  const pages = await pooled(links, async (u) => {
    const html = await fetchText(u, { timeoutMs: 20_000, browserUa, retries: 1 })
    const node = extractLdNodes(html).find(isEvent)
    return node ? toEvent(node, src, u) : null
  }, 6)

  return upsizeImages(pages.filter((e): e is ScrapedEvent => e !== null))
}
