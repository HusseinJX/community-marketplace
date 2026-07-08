import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { placesSearch } from '@/lib/places'
import { rateLimit } from '@/lib/rate-limit'

// GET ?q= — Google Places text search, proxied server-side (key stays off the
// browser). Signed-in only + rate-limited (each call costs a Google API request).
export async function GET(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const limited = rateLimit({ req, name: 'places-search', id: userId, limit: 40, windowMs: 60_000 })
  if (limited) return limited

  const q = new URL(req.url).searchParams.get('q') ?? ''
  if (q.trim().length < 3) return NextResponse.json({ results: [] })
  return NextResponse.json({ results: await placesSearch(q) })
}
