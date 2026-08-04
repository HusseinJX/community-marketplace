// Coordinates for scraped events — so the feed can answer "what's near me".
//
// THE KEY INSIGHT: geocode VENUES, not events. 796 events resolve to 211
// distinct venues (a 4:1 ratio that only improves as sources repeat), and venues
// don't move. So one cached lookup per venue serves every event there, forever.
//
// Three tiers, cheapest first:
//   1. NATIVE   — the source already published coordinates (Luma, Localist).
//   2. SOURCE   — a single-campus source has one location; an event with no
//                 venue of its own inherits it (Fort Mason's 162 events).
//   3. GEOCODE  — look the venue up once and cache it in data/venues.json.
//
// Geocoding defaults to Nominatim (OpenStreetMap): free, no key, but rate
// limited to 1 req/sec by their usage policy — which we honour. Google is
// available via GOOGLE_PLACES_API_KEY for the messy strings Nominatim misses,
// but it is opt-in because Google bills per request (see lib/places.ts).

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import type { ScrapedEvent } from './types'

export interface LatLng { lat: number; lng: number }

/**
 * Bay Area bounding box. Anything outside it is rejected rather than trusted —
 * a bad geocode puts an event in the ocean, and a wrong pin is worse than no
 * pin because the proximity filter will confidently show it to the wrong person.
 *
 * Deliberately generous (Santa Rosa → Santa Cruz, Pacific → Stockton) so that
 * genuinely regional events survive; UCSF's calendar, for example, carries
 * events as far out as Olympic Valley, which this correctly excludes.
 */
const BBOX = { minLat: 36.9, maxLat: 38.9, minLng: -123.2, maxLng: -121.2 }

export function inBayArea(p: LatLng | null): p is LatLng {
  if (!p) return false
  const { lat, lng } = p
  return (
    Number.isFinite(lat) && Number.isFinite(lng) &&
    lat >= BBOX.minLat && lat <= BBOX.maxLat &&
    lng >= BBOX.minLng && lng <= BBOX.maxLng
  )
}

/**
 * Reject coordinates that are structurally implausible even before the bbox.
 * The Events Calendar plugin returns `geo_lat: 37, geo_lng: 122` for Yerba Buena
 * — integer-truncated AND sign-flipped. Whole-number coordinates are never a
 * real venue fix, so we treat them as missing.
 */
export function plausible(lat: unknown, lng: unknown): LatLng | null {
  const a = typeof lat === 'string' ? Number(lat) : lat
  const b = typeof lng === 'string' ? Number(lng) : lng
  if (typeof a !== 'number' || typeof b !== 'number') return null
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null
  if (Number.isInteger(a) && Number.isInteger(b)) return null // truncated junk
  if (a === 0 || b === 0) return null
  return { lat: a, lng: b }
}

// ── venue cache ──────────────────────────────────────────────────────────────

const CACHE_PATH = join(process.cwd(), 'data', 'venues.json')

export interface VenueEntry {
  query: string
  lat: number | null
  lng: number | null
  display?: string
  /** Where the fix came from, so a bad batch can be invalidated selectively. */
  via: 'native' | 'source' | 'nominatim' | 'google' | 'miss'
  /** Set once Google has been asked, so a paid lookup is never repeated. */
  triedGoogle?: boolean
  at: string
}

type Cache = Record<string, VenueEntry>

export function loadCache(): Cache {
  try {
    return JSON.parse(readFileSync(CACHE_PATH, 'utf8')) as Cache
  } catch {
    return {}
  }
}

/**
 * Best-effort. The cache is an optimisation, not state we depend on — and this
 * same code runs inside the Trigger.dev sweep, where the working directory is
 * read-only. An unguarded write there throws and takes the whole scrape down
 * with it, losing hundreds of successfully-parsed events to a failed attempt at
 * saving a lookup table.
 *
 * Consequence worth knowing: on a read-only host every run re-geocodes, so the
 * free Nominatim tier does the work again each sweep and Google is re-billed
 * for whatever it misses. Fixing that properly means moving this cache into
 * Supabase; until then the cost is small and bounded, and correctness is not
 * affected.
 */
export function saveCache(cache: Cache): void {
  try {
    mkdirSync(join(process.cwd(), 'data'), { recursive: true })
    writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 1))
  } catch {
    /* read-only filesystem — carry on without persisting the cache */
  }
}

/** Cache key: normalised so "Main " and "main" don't cost two lookups. */
export function keyFor(query: string): string {
  return query.toLowerCase().replace(/\s+/g, ' ').trim()
}

// ── geocoders ────────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function nominatim(query: string): Promise<{ p: LatLng; display: string } | null> {
  // viewbox biases results toward the Bay Area; bounded=0 keeps it a preference
  // rather than a hard filter, so a genuinely regional venue still resolves and
  // is then judged by inBayArea() on its merits.
  const box = `${BBOX.minLng},${BBOX.maxLat},${BBOX.maxLng},${BBOX.minLat}`
  const url =
    'https://nominatim.openstreetmap.org/search' +
    `?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=us` +
    `&viewbox=${box}&bounded=0`
  const res = await fetch(url, {
    headers: {
      // Nominatim's policy requires a genuine identifying UA.
      'User-Agent': 'WhatsLocalBot/1.0 (https://whatslocal.ai; events@whatslocal.ai)',
      'Accept-Language': 'en',
    },
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) return null
  const rows = (await res.json()) as { lat?: string; lon?: string; display_name?: string }[]
  const r = rows?.[0]
  const p = r ? plausible(r.lat, r.lon) : null
  return p ? { p, display: r?.display_name ?? query } : null
}

async function google(query: string, key: string): Promise<{ p: LatLng; display: string } | null> {
  const bounds = `${BBOX.minLat},${BBOX.minLng}|${BBOX.maxLat},${BBOX.maxLng}`
  const url =
    'https://maps.googleapis.com/maps/api/geocode/json' +
    `?address=${encodeURIComponent(query)}&bounds=${encodeURIComponent(bounds)}` +
    `&region=us&key=${key}`
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) })
  if (!res.ok) return null
  const j = (await res.json()) as {
    results?: { geometry?: { location?: { lat: number; lng: number } }; formatted_address?: string }[]
  }
  const r = j.results?.[0]
  const p = r?.geometry?.location ? plausible(r.geometry.location.lat, r.geometry.location.lng) : null
  return p ? { p, display: r?.formatted_address ?? query } : null
}

/**
 * Resolve a batch of venue queries, using and updating the on-disk cache.
 * Only genuinely new queries hit the network — a second run costs nothing.
 */
export async function geocodeVenues(
  queries: string[],
  opts: { useGoogle?: boolean; log?: (s: string) => void } = {}
): Promise<Cache> {
  const cache = loadCache()
  const key = process.env.GOOGLE_PLACES_API_KEY
  const useGoogle = opts.useGoogle !== false && Boolean(key)

  const wanted = [...new Set(queries.map(keyFor))]
  const fresh = wanted.filter((k) => !(k in cache))
  // A previous run's miss is worth one Google attempt — but only ever one, since
  // Google bills per request. `triedGoogle` makes that permanent.
  const retry = useGoogle
    ? wanted.filter((k) => cache[k]?.via === 'miss' && !cache[k]?.triedGoogle)
    : []

  if (!fresh.length && !retry.length) return cache
  opts.log?.(
    `geocoding ${fresh.length} new venues` +
    (retry.length ? ` + ${retry.length} retries via Google` : '') +
    ` (${Object.keys(cache).length} cached)`
  )

  const stamp = () => new Date().toISOString()
  let done = 0
  const total = fresh.length + retry.length

  for (const k of [...fresh, ...retry]) {
    const original = queries.find((q) => keyFor(q) === k) ?? cache[k]?.query ?? k
    const isRetry = !fresh.includes(k)
    let hit: { p: LatLng; display: string } | null = null
    let via: VenueEntry['via'] = 'miss'

    try {
      // Free geocoder first; Google only where it fails. Nominatim resolves
      // clean addresses fine but misses named venues ("House of Air"), which is
      // exactly where Google earns the fraction of a cent.
      if (!isRetry) {
        hit = await nominatim(original)
        if (hit) via = 'nominatim'
      }
      if (!hit && useGoogle) {
        hit = await google(original, key!)
        if (hit) via = 'google'
      }
    } catch {
      hit = null
    }

    const ok = hit && inBayArea(hit.p)
    cache[k] = ok
      ? { query: original, lat: hit!.p.lat, lng: hit!.p.lng, display: hit!.display, via,
          triedGoogle: useGoogle, at: stamp() }
      : { query: original, lat: null, lng: null, via: 'miss', triedGoogle: useGoogle, at: stamp() }

    done++
    if (done % 25 === 0) opts.log?.(`  …${done}/${total}`)
    // Nominatim's usage policy caps us at one request per second; Google has no
    // such limit, so retries (Google-only) don't pay the wait.
    if (!isRetry) await sleep(1100)
  }

  saveCache(cache)
  const hits = Object.values(cache).filter((v) => v.lat != null).length
  opts.log?.(`  venues resolved ${hits}/${Object.keys(cache).length}`)
  return cache
}

// ── distance ─────────────────────────────────────────────────────────────────

/** Great-circle distance in miles. */
export function milesBetween(a: LatLng, b: LatLng): number {
  const R = 3958.8
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

/**
 * The query we hand a geocoder for one event, best-available first.
 *
 * NEVER append a city name to a string that already names a place. Doing so
 * produced the worst bug in this file's history: "Santa Cruz Civic Auditorium,
 * 307 Church St" became "…, San Francisco, CA", and Google dutifully returned a
 * real 307 Church St in the Mission — a confident pin seventy miles from the
 * actual venue, which then showed up in "events near me".
 *
 * Locality comes from the geocoder's bounds parameter instead (see `nominatim`
 * and `google` above), which biases without lying.
 */
const CITY_MENTIONED =
  /\b(san francisco|oakland|berkeley|santa cruz|san jose|pacifica|napa|sausalito|marin|alameda|daly city|palo alto|richmond|emeryville|san mateo|walnut creek|petaluma)\b/i

export function venueQuery(
  e: ScrapedEvent,
  template?: string,
  aliases?: Record<string, string>
): string | null {
  // An explicit alias always wins — it exists precisely because the generic
  // paths get this venue wrong.
  if (e.venue && aliases?.[e.venue]) return aliases[e.venue]

  // A full street address beats anything we could compose.
  if (e.location && /\d/.test(e.location) && e.location.length > 12) {
    // Already carries a city or a state — hand it over untouched.
    if (CITY_MENTIONED.test(e.location) || /,\s*[A-Z]{2}\b/.test(e.location)) return e.location
    // Otherwise add the STATE only. Never a city.
    return `${e.location}, CA`
  }

  if (!e.venue) return null
  // Sources whose venue field is a bare label ("Main", "Excelsior") need context,
  // and their template is a per-source promise that the label really is local.
  if (template) return template.replace('{venue}', e.venue)
  if (CITY_MENTIONED.test(e.venue)) return e.venue
  return `${e.venue}, CA`
}
