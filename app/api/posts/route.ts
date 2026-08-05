import { NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { createPost, getPosts, getPostsByMemberId, getPostsByEventId, getReactionsForPosts } from '@/lib/posts'
import { isDemoMode } from '@/lib/demo-admin'
import { rateLimit } from '@/lib/rate-limit'

// GET — public feed of share posts. `?member=` / `?event=` scope to one entity's
// "memories" (everyone's media tagged to that business or event). Each post is
// enriched with its ❤️ count + whether the viewer reacted.
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const member = searchParams.get('member')
    const event = searchParams.get('event')
    const { userId } = await auth()
    const posts = member
      ? await getPostsByMemberId(member, 100, userId)
      : event
        ? await getPostsByEventId(event, 100, userId)
        : await getPosts(50, userId)
    const reactions = await getReactionsForPosts(posts.map((p) => p.id), userId)
    const enriched = posts.map((p) => ({
      ...p,
      reactions: reactions[p.id]?.count ?? 0,
      reacted: reactions[p.id]?.reacted ?? false,
    }))
    return NextResponse.json({ posts: enriched })
  } catch {
    return NextResponse.json({ posts: [] })
  }
}

// POST — create a share post. Any signed-in user; demo mode allows anonymous.
export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId && !isDemoMode()) {
    return NextResponse.json({ error: 'Sign in to post' }, { status: 401 })
  }

  const limited = rateLimit({ req: request, name: 'posts', id: userId, limit: 15, windowMs: 600_000 })
  if (limited) return limited

  let authorName: string | null = null
  if (userId) {
    const u = await currentUser()
    authorName = u?.firstName || u?.username || u?.emailAddresses?.[0]?.emailAddress || null
  }

  const b = await request.json().catch(() => ({}))
  const body = (b.body ?? '').toString().trim()
  const imageUrls: string[] = Array.isArray(b.imageUrls) ? b.imageUrls : []
  const videoUrls: string[] = Array.isArray(b.videoUrls) ? b.videoUrls : []

  if (!body && imageUrls.length === 0 && videoUrls.length === 0 && !b.livestreamUrl) {
    return NextResponse.json({ error: 'Post is empty' }, { status: 400 })
  }

  // Every post must carry a location tag (auto-captured by the composer).
  const location = (b.location ?? '').toString().trim()
  if (!location) {
    return NextResponse.json({ error: 'A location tag is required to post.' }, { status: 400 })
  }

  // Coordinates behind that label, when the composer had a real fix. Rounded to
  // ~110m to match what the app already persists — a post is a neighbourhood
  // signal, not a doorstep. Anything out of range or unparseable becomes null
  // rather than a number we'd later print as a distance.
  const coord = (v: unknown, max: number): number | null => {
    const n = typeof v === 'number' ? v : Number(v)
    if (!Number.isFinite(n) || Math.abs(n) > max) return null
    return Math.round(n * 1000) / 1000
  }
  const lat = coord(b.lat, 90)
  const lng = coord(b.lng, 180)
  // Both or neither: half a coordinate places nothing.
  const placed = lat !== null && lng !== null && !(lat === 0 && lng === 0)

  try {
    const post = await createPost({
      author_id: userId ?? 'demo',
      author_name: authorName,
      body: body || null,
      image_urls: imageUrls,
      video_urls: videoUrls,
      tagged_member_id: b.taggedMemberId ?? null,
      tagged_member_name: b.taggedMemberName ?? null,
      tagged_event_id: b.taggedEventId ?? null,
      tagged_event_title: b.taggedEventTitle ?? null,
      livestream_url: b.livestreamUrl ?? null,
      location,
      lat: placed ? lat : null,
      lng: placed ? lng : null,
    })
    return NextResponse.json({ post })
  } catch (err) {
    // In demo mode the `posts` table may not be pushed yet — soft-succeed so the
    // composer flow works end-to-end. Real (non-demo) usage surfaces the error.
    if (isDemoMode()) {
      return NextResponse.json({ post: { id: 'demo', ...b }, demo: true })
    }
    const message = err instanceof Error ? err.message : 'Failed to post'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
