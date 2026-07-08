// Server-side Google Places proxy. Keeps the (unrestricted) GOOGLE_PLACES_API_KEY
// off the browser — the create UI calls our /api/places/* routes, never Google
// directly. Powers "search a business → pick the real listing → auto-fill".

const KEY = () => process.env.GOOGLE_PLACES_API_KEY

export interface PlaceCandidate {
  placeId: string
  name: string
  address: string
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
  types: string[]
  lat: number | null
  lng: number | null
  city: string | null
  neighborhood: string | null
}

/** Text search → up to 6 candidate listings (name + address + place_id). */
export async function placesSearch(query: string): Promise<PlaceCandidate[]> {
  const key = KEY()
  if (!key || !query.trim()) return []
  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${key}`,
      { signal: AbortSignal.timeout(10000) }
    )
    if (!res.ok) return []
    const data = await res.json()
    return (data.results || []).slice(0, 6).map((r: Record<string, unknown>) => ({
      placeId: String(r.place_id),
      name: String(r.name),
      address: String(r.formatted_address ?? ''),
    }))
  } catch {
    return []
  }
}

/** Full details for one listing → normalized, ready to auto-fill the create form. */
export async function placeDetails(placeId: string): Promise<PlaceDetails | null> {
  const key = KEY()
  if (!key || !placeId) return null
  const fields =
    'name,formatted_address,formatted_phone_number,opening_hours,website,editorial_summary,rating,types,geometry,address_components'
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
    return {
      placeId,
      name: r.name,
      address: r.formatted_address ?? null,
      phone: r.formatted_phone_number ?? null,
      website: r.website ?? null,
      hours: r.opening_hours?.weekday_text?.join(', ') ?? null,
      summary: r.editorial_summary?.overview ?? null,
      rating: r.rating ?? null,
      types: r.types ?? [],
      lat: r.geometry?.location?.lat ?? null,
      lng: r.geometry?.location?.lng ?? null,
      city: comp('locality') || comp('postal_town') || null,
      neighborhood:
        comp('neighborhood') || comp('sublocality') || comp('sublocality_level_1') || null,
    }
  } catch {
    return null
  }
}
