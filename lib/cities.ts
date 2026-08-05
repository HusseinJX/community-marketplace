// Which cities WhatsLocal is actually in — derived, never declared.
//
// A city is live when at least one enabled source points at it. That is the
// whole rule. It exists because the alternative was a hand-typed
// `status: "live"` flag sitting next to a real scraping pipeline, which meant
// the city header could claim we were in a city that had no events in it, or
// stay silent about one that did. Adding the first Oakland source to
// lib/sources/registry.ts is what turns Oakland on — nothing else to remember,
// and nothing that can disagree.
//
// The catalog below is only the list of cities we can NAME and place on a map:
// it answers "which city is nearest to this person" so the header can say
// "we're not in Oakland yet" and offer the interest button. Being in the
// catalog says nothing about being live.
//
// NOT a database yet, deliberately. Each source is a scraping recipe (selectors,
// URL patterns, venue templates), not a row someone types into a form, so
// sources ship with a deploy — and while that is true, cities may as well too.
// When `event_sources` becomes a Supabase table, this file reads from it and
// every caller stays the same.

import { SOURCES } from '@/lib/sources/registry'

export interface City {
  id: string
  countryId: string
  /** Display name. */
  city: string
  emoji: string
  lat: number
  lng: number
}

/** Cities we can name and locate. Live-ness is NOT stored here — it's derived. */
export const CITIES: City[] = [
  { id: 'sf', countryId: 'us', city: 'San Francisco', emoji: '🌉', lat: 37.7749, lng: -122.4194 },
  { id: 'oak', countryId: 'us', city: 'Oakland', emoji: '🌳', lat: 37.8044, lng: -122.2712 },
  { id: 'la', countryId: 'us', city: 'Los Angeles', emoji: '🌴', lat: 34.0522, lng: -118.2437 },
  { id: 'nyc', countryId: 'us', city: 'New York', emoji: '🗽', lat: 40.7128, lng: -74.006 },
  { id: 'chi', countryId: 'us', city: 'Chicago', emoji: '🌆', lat: 41.8781, lng: -87.6298 },
]

/** City ids that have at least one source — computed once at module load. */
const LIVE_IDS: ReadonlySet<string> = new Set(
  SOURCES.filter((s) => s.enabled !== false).map((s) => s.city),
)

/** True when this city has a source feeding it. The only definition of "live". */
export function isCityLive(id: string): boolean {
  return LIVE_IDS.has(id)
}

/** Every live city, in catalog order. */
export function liveCities(): City[] {
  return CITIES.filter((c) => isCityLive(c.id))
}

/** How many sources feed a city — what the admin Sourcing screen counts. */
export function sourceCountFor(id: string): number {
  return SOURCES.filter((s) => s.city === id && s.enabled !== false).length
}

export function cityById(id: string): City | undefined {
  return CITIES.find((c) => c.id === id)
}

/** Great-circle distance in miles (haversine). */
function milesBetween(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 3958.8
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(bLat - aLat)
  const dLng = toRad(bLng - aLng)
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

/**
 * The nearest city to a point, and how far away it is.
 *
 * `liveOnly` asks a different question — "what's the nearest city we actually
 * cover" — which is what the not-covered-yet message needs so it can name a
 * real alternative instead of another city we aren't in either.
 */
export function nearestCity(
  lat: number,
  lng: number,
  opts: { liveOnly?: boolean } = {},
): { city: City; miles: number } | null {
  const pool = opts.liveOnly ? liveCities() : CITIES
  let best: { city: City; miles: number } | null = null
  for (const c of pool) {
    const miles = milesBetween(lat, lng, c.lat, c.lng)
    if (!best || miles < best.miles) best = { city: c, miles }
  }
  return best
}
