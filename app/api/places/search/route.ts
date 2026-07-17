import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { placesSearch } from '@/lib/places'
import { rateLimit } from '@/lib/rate-limit'
import { isDemoMode } from '@/lib/demo-admin'
import { isJoinDemoActive } from '@/lib/joindemo'

// GET ?q=&region= — Google Places text search, proxied server-side (key stays
// off the browser). Signed-in only + rate-limited: every call costs money.
//
// The callers submit a finished query (a Search button / a debounce), never a
// keystroke, and lib/places caches the result for a day — so the limit below is
// a backstop against abuse, not the thing keeping the bill down.
//
// `region` is a ccTLD ("us", "gb", "mx") that biases ranking. Without it Google
// biases on the requesting IP — which is OUR SERVER, so every user in the world
// would get results ranked around our datacenter.
export async function GET(req: Request) {
  const { userId } = await auth()
  // Read-only Google call — allow the side-effect-free /joindemo walkthrough.
  if (!userId && !isDemoMode() && !(await isJoinDemoActive())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const limited = rateLimit({ req, name: 'places-search', id: userId ?? 'demo', limit: 15, windowMs: 60_000 })
  if (limited) return limited

  const url = new URL(req.url)
  const q = url.searchParams.get('q') ?? ''
  const region = url.searchParams.get('region')
  if (q.trim().length < 3) return NextResponse.json({ results: [] })
  return NextResponse.json({ results: await placesSearch(q, { limit: 3, region }) })
}
