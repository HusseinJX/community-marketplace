// Server-side Google Places proxy. Keeps the (unrestricted) GOOGLE_PLACES_API_KEY
// off the browser — the create UI calls our /api/places/* routes, never Google
// directly. Powers "search a business → pick the real listing → auto-fill".
//
// ── Spending rules, because every call here is money ─────────────────────────
//
// Google bills PER REQUEST, not per result. The number of requests is the only
// thing that moves the bill — capping results is a UX choice, not a saving.
//
//  1. ONE search per search. /join used to fire a Text Search on every keystroke
//     (no debounce): ~12 billed calls to type "Tartine Bakery". It's a button
//     now — you finish typing, you press it, we spend once.
//  2. Never buy the same thing twice. Both layers are cached below, so a repeated
//     query, a re-picked listing, stepping back through the flow, or two people
//     looking up the same business all cost nothing after the first.
//  3. Never throw away what we paid for. Text Search already returns geometry,
//     rating, types, price level and business status for every result — we keep
//     ALL of it (see PlaceCandidate) and hand it to placeDetails, which then only
//     asks Google for what Text Search can't give (phone, website, editorial
//     summary, address components, opening hours).
//
// One onboarding: 1 Text Search + 1 Details. It was ~13.
//
// Caching note: Google's terms allow caching place_id indefinitely and other
// Place content for up to 30 days. A day is well inside that, and this process
// is long-lived (CapRover container), so the cache actually survives.

const KEY = () => process.env.GOOGLE_PLACES_API_KEY

const DAY = 24 * 60 * 60 * 1000
type Cached<T> = { at: number; value: T }

const searchCache = new Map<string, Cached<PlaceCandidate[]>>()
const detailsCache = new Map<string, Cached<PlaceDetails>>()
// Everything a paid Text Search told us, kept per place so placeDetails doesn't
// re-buy it. Not a cost cache — a "we already own this" ledger.
const candidateCache = new Map<string, Cached<PlaceCandidate>>()
// Neighborhood labels, keyed on a ~1km grid square rather than an exact fix —
// see reverseGeocode for why that's the whole point.
const reverseCache = new Map<string, Cached<string>>()

function fresh<T>(c: Cached<T> | undefined, ttl = DAY): T | null {
  if (!c) return null
  return Date.now() - c.at < ttl ? c.value : null
}

/** Bounded, so a long-lived process can't grow forever. Oldest out first. */
function remember<T>(map: Map<string, Cached<T>>, key: string, value: T, max = 500): void {
  map.set(key, { at: Date.now(), value })
  if (map.size > max) {
    const excess = [...map.entries()].sort((a, b) => a[1].at - b[1].at).slice(0, map.size - max)
    for (const [k] of excess) map.delete(k)
  }
}

export interface PlaceCandidate {
  placeId: string
  name: string
  address: string
  // Everything else Text Search hands over on the same request. Kept so the
  // pick, the profile and the interview brief can all use it — and so Details
  // never has to ask for it again.
  lat: number | null
  lng: number | null
  rating: number | null
  userRatingsTotal: number | null
  types: string[]
  priceLevel: number | null
  businessStatus: string | null
  openNow: boolean | null
}

export interface PlaceDetails {
  placeId: string
  name: string
  address: string | null
  phone: string | null
  website: string | null
  hours: string | null
  summary: string | null
  rating: number | null
  userRatingsTotal: number | null
  types: string[]
  priceLevel: number | null
  businessStatus: string | null
  lat: number | null
  lng: number | null
  city: string | null
  neighborhood: string | null
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)

/**
 * Text search → the few best candidate listings, with everything Google returned.
 *
 * `limit` is presentation only — Google bills the request, not the rows. Kept
 * tight (3) because a long list is a worse decision, not a bigger bill.
 * `region` biases ranking: without it Google falls back to the *server's* IP, so
 * every user everywhere gets results ranked around our datacenter.
 */
export async function placesSearch(
  query: string,
  opts: { limit?: number; region?: string | null } = {}
): Promise<PlaceCandidate[]> {
  const key = KEY()
  const q = query.trim()
  if (!key || !q) return []

  const limit = opts.limit ?? 3
  const region = opts.region?.trim().toLowerCase() || ''
  const cacheKey = `${q.toLowerCase()}|${region}|${limit}`
  const hit = fresh(searchCache.get(cacheKey))
  if (hit) return hit

  try {
    const url = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json')
    url.searchParams.set('query', q)
    if (region) url.searchParams.set('region', region)
    url.searchParams.set('key', key)
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
    if (!res.ok) return []
    const data = await res.json()
    const results: PlaceCandidate[] = (data.results || []).slice(0, limit).map((r: Record<string, unknown>) => {
      const geo = r.geometry as { location?: { lat?: number; lng?: number } } | undefined
      const oh = r.opening_hours as { open_now?: boolean } | undefined
      return {
        placeId: String(r.place_id),
        name: String(r.name),
        address: String(r.formatted_address ?? ''),
        lat: num(geo?.location?.lat),
        lng: num(geo?.location?.lng),
        rating: num(r.rating),
        userRatingsTotal: num(r.user_ratings_total),
        types: (r.types as string[]) ?? [],
        priceLevel: num(r.price_level),
        businessStatus: (r.business_status as string) ?? null,
        openNow: typeof oh?.open_now === 'boolean' ? oh.open_now : null,
      }
    })

    remember(searchCache, cacheKey, results)
    // Bank each candidate: we've paid for this, placeDetails shouldn't re-buy it.
    for (const c of results) remember(candidateCache, c.placeId, c)
    return results
  } catch {
    return []
  }
}

/** Reverse-geocode lat/lng → a short human label ("Mission District, SF"). */
/**
 * Coordinates → a short neighborhood label ("Mission District, SF").
 *
 * Cached on a ~1km grid (2dp), not on the raw fix. Two reasons, both from the
 * spending rules above: a raw lat/lng is unique to the metre so it would never
 * hit, and the answer is a *neighborhood* — every phone within a block of you
 * has the same one. So the second person on that block, and you re-opening the
 * composer, cost nothing and return instantly instead of paying a Geocoding
 * request plus a round trip to Google.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  const key = KEY()
  if (!key || !Number.isFinite(lat) || !Number.isFinite(lng)) return null
  const cacheKey = `${lat.toFixed(2)},${lng.toFixed(2)}`
  const hit = fresh(reverseCache.get(cacheKey))
  if (hit !== null) return hit
  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&result_type=neighborhood|sublocality|locality&key=${key}`,
      { signal: AbortSignal.timeout(10000) }
    )
    if (!res.ok) return null
    const data = await res.json()
    const first = data.results?.[0]
    if (!first) return null
    const comp = (type: string): string | null =>
      first.address_components?.find((c: { types: string[]; short_name: string; long_name: string }) =>
        c.types.includes(type)
      )?.long_name ?? null
    const area = comp('neighborhood') ?? comp('sublocality') ?? comp('locality')
    const city = comp('locality')
    const label =
      area && city && area !== city
        ? `${area}, ${city}`
        : area ?? city ?? (first.formatted_address as string) ?? null
    // Only successes are cached — a miss is cheap and rare (ocean, no result),
    // and caching it would mean `fresh()` couldn't tell it from a cache miss.
    if (label) remember(reverseCache, cacheKey, label)
    return label
  } catch {
    return null
  }
}

/**
 * Full details for one listing → normalized, ready to auto-fill the create form.
 *
 * Two savings, in order of size:
 *  · Cached per place for a day — re-picking, stepping back, or a second person
 *    looking up the same business is free.
 *  · If a prior search already told us this place's name/geometry/rating/types
 *    (the usual path: you searched, then picked), we don't ask for them again —
 *    only for the fields Text Search can't return — and merge the two.
 *
 * Same shape either way, so a caller with a bare placeId and no prior search
 * (e.g. a deep link) still gets everything.
 */
export async function placeDetails(placeId: string): Promise<PlaceDetails | null> {
  const key = KEY()
  if (!key || !placeId) return null

  const cached = fresh(detailsCache.get(placeId))
  if (cached) return cached

  // What a previous Text Search already bought us.
  const known = fresh(candidateCache.get(placeId))

  // Only ever ask for what Text Search cannot give: contact, the editorial
  // summary, opening hours, and the parsed address components (city/hood).
  const MISSING_FROM_SEARCH = 'formatted_phone_number,website,editorial_summary,opening_hours,address_components'
  const fields = known
    ? MISSING_FROM_SEARCH
    : `name,formatted_address,rating,user_ratings_total,types,price_level,business_status,geometry,${MISSING_FROM_SEARCH}`

  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=${fields}&key=${key}`,
      { signal: AbortSignal.timeout(10000) }
    )
    if (!res.ok) return null
    const data = await res.json()
    const r = data.result
    if (!r) return null
    const comp = (type: string): string | null =>
      r.address_components?.find((c: { types: string[]; long_name: string }) => c.types.includes(type))?.long_name ?? null

    const details: PlaceDetails = {
      placeId,
      // Prefer what we already own; fall back to whatever this call returned.
      name: known?.name ?? r.name,
      address: known?.address || r.formatted_address || null,
      lat: known?.lat ?? num(r.geometry?.location?.lat),
      lng: known?.lng ?? num(r.geometry?.location?.lng),
      rating: known?.rating ?? num(r.rating),
      userRatingsTotal: known?.userRatingsTotal ?? num(r.user_ratings_total),
      types: known?.types?.length ? known.types : ((r.types as string[]) ?? []),
      priceLevel: known?.priceLevel ?? num(r.price_level),
      businessStatus: known?.businessStatus ?? (r.business_status ?? null),
      // Only Details has these.
      phone: r.formatted_phone_number ?? null,
      website: r.website ?? null,
      hours: r.opening_hours?.weekday_text?.join(', ') ?? null,
      summary: r.editorial_summary?.overview ?? null,
      city: comp('locality') || comp('postal_town') || null,
      neighborhood: comp('neighborhood') || comp('sublocality') || comp('sublocality_level_1') || null,
    }
    remember(detailsCache, placeId, details)
    return details
  } catch {
    return null
  }
}
