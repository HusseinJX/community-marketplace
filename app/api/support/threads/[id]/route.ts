import { NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { isAdmin } from '@/lib/admin'
import { cleanBody, getThreadById, listMessages, markRead, send } from '@/lib/support'
import { notifyUserSafe } from '@/lib/notify'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// One conversation, from the staff side: read it, answer it, mark it read.

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth()
  if (!isAdmin(userId)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  const { id } = await params
  const thread = await getThreadById(id)
  if (!thread) return NextResponse.json({ error: 'No such thread' }, { status: 404 })
  return NextResponse.json({ thread, messages: await listMessages(thread.id) })
}

// POST { body } → reply as staff.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth()
  if (!isAdmin(userId)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { id } = await params
  const thread = await getThreadById(id)
  if (!thread) return NextResponse.json({ error: 'No such thread' }, { status: 404 })

  const raw = await req.json().catch(() => ({}))
  const body = cleanBody(raw?.body)
  if (!body) return NextResponse.json({ error: 'Empty reply' }, { status: 400 })

  const me = await currentUser().catch(() => null)
  const { message } = await send({
    clerkUserId: thread.clerk_user_id,
    sender: 'staff',
    body,
    authorName: me?.firstName || 'WhatsLocal',
  })

  // Push AND email, never push alone (lib/notify) — someone who asked for help
  // from a laptop has no app to receive it.
  void notifyUserSafe(thread.clerk_user_id, {
    title: 'WhatsLocal support replied',
    body: body.slice(0, 140),
    url: '/support/chat',
  })

  return NextResponse.json({ ok: true, message })
}

// PATCH → mark this thread read on OUR side.
export async function PATCH(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth()
  if (!isAdmin(userId)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  const { id } = await params
  await markRead(id, 'staff')
  return NextResponse.json({ ok: true })
}
