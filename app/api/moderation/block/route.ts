import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { rateLimit } from '@/lib/rate-limit'
import { blockUser, unblockUser } from '@/lib/moderation'

// Block / unblock a user (App Store 1.2). Blocking instantly removes the blocked
// user's content from the blocker's feeds (filtered in lib/posts) and notifies
// the developer. The client also drops their posts immediately for instant UX.
export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Sign in to block' }, { status: 401 })

  const limited = rateLimit({ req, name: 'block', id: userId, limit: 40, windowMs: 600_000 })
  if (limited) return limited

  const { authorId } = (await req.json().catch(() => ({}))) as { authorId?: string }
  if (!authorId) return NextResponse.json({ error: 'missing_user' }, { status: 400 })

  try {
    await blockUser(userId, authorId)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'failed' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Sign in' }, { status: 401 })
  const { authorId } = (await req.json().catch(() => ({}))) as { authorId?: string }
  if (!authorId) return NextResponse.json({ error: 'missing_user' }, { status: 400 })
  try {
    await unblockUser(userId, authorId)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'failed' }, { status: 500 })
  }
}
