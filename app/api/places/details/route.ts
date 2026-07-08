import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { placeDetails } from '@/lib/places'
import { rateLimit } from '@/lib/rate-limit'

// GET ?placeId= — full listing details, normalized to auto-fill the create form.
export async function GET(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const limited = rateLimit({ req, name: 'places-details', id: userId, limit: 40, windowMs: 60_000 })
  if (limited) return limited

  const placeId = new URL(req.url).searchParams.get('placeId') ?? ''
  if (!placeId) return NextResponse.json({ error: 'placeId required' }, { status: 400 })
  const details = await placeDetails(placeId)
  if (!details) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  return NextResponse.json({ details })
}
