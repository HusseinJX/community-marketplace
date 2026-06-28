import { NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { createPost, getPosts } from '@/lib/posts'
import { isDemoMode } from '@/lib/demo-admin'

// GET — public feed of share posts.
export async function GET() {
  try {
    const posts = await getPosts()
    return NextResponse.json({ posts })
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
