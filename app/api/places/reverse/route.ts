import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { reverseGeocode } from '@/lib/places'
import { rateLimit } from '@/lib/rate-limit'

// GET ?lat=&lng= — reverse-geocode the device's current position into a short
// human label ("Mission District, SF"), proxied server-side (key stays off the
// browser). Signed-in only + rate-limited (each call costs a Google API request).
export async function GET(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const limited = rateLimit({ req, name: 'places-reverse', id: userId, limit: 40, windowMs: 60_000 })
  if (limited) return limited

  const url = new URL(req.url)
  const lat = Number(url.searchParams.get('lat'))
  const lng = Number(url.searchParams.get('lng'))
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: 'lat/lng required' }, { status: 400 })
  }
  return NextResponse.json({ label: await reverseGeocode(lat, lng) })
}
