import { NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { getThread, listMessages, markRead, send, unreadForUser, cleanBody } from '@/lib/support'
import { getVendorProfile } from '@/lib/vendor-connect'
import { adminUserIds } from '@/lib/admin'
import { notifyUserSafe } from '@/lib/notify'

export const runtime = 'nodejs'
// A conversation is never cacheable, and the badge is read on every tab.
export const dynamic = 'force-dynamic'

// The PERSON's side of support chat. The staff side is /api/support/threads.
//
// Signed-in only, and it identifies the person from the session — never from
// the body. A support thread keyed by anything a client could send would let
// anyone read anyone's conversation with us.

// GET → { unread } always; { messages } too unless ?badge=1.
// The badge poll is the hot path: it runs for every signed-in person on every
// tab, so it reads ONE integer off one row and never touches the messages.
export async function GET(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ unread: 0, messages: [] })

  const badgeOnly = new URL(req.url).searchParams.get('badge') === '1'
  if (badgeOnly) return NextResponse.json({ unread: await unreadForUser(userId) })

  const thread = await getThread(userId)
  if (!thread) return NextResponse.json({ unread: 0, messages: [] })
  return NextResponse.json({
    unread: thread.user_unread,
    messages: await listMessages(thread.id),
  })
}

// POST { body } → send a message to us.
export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Sign in to message support' }, { status: 401 })

  const raw = await req.json().catch(() => ({}))
  const body = cleanBody(raw?.body)
  if (!body) return NextResponse.json({ error: 'Say something first' }, { status: 400 })

  const user = await currentUser().catch(() => null)
  const name =
    [user?.firstName, user?.lastName].filter(Boolean).join(' ') ||
    user?.username ||
    null
  const email = user?.emailAddresses?.[0]?.emailAddress ?? null
  // Their business, when they have one. Most support questions start with
  // "which vendor is this?" and looking it up per message is the difference
  // between answering and asking them who they are.
  const vendor = await getVendorProfile(userId).catch(() => null)

  const { message } = await send({
    clerkUserId: userId,
    sender: 'user',
    body,
    displayName: name,
    email,
    memberId: vendor?.member_id ?? null,
  })

  // Tell the humans. Fire-and-forget on purpose — the message is already
  // stored, and a slow APNs call must not hold the composer open.
  for (const admin of adminUserIds()) {
    void notifyUserSafe(admin, {
      title: `Support — ${name || email || 'someone'}`,
      body: body.slice(0, 140),
      url: '/vendor/admin?tab=support',
    })
  }

  return NextResponse.json({ ok: true, message })
}

// PATCH → mark the staff replies read (clears the red badge). Its own verb
// rather than a side effect of GET: opening the badge poll is not reading.
export async function PATCH() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ ok: true })
  const thread = await getThread(userId)
  if (thread) await markRead(thread.id, 'user')
  return NextResponse.json({ ok: true })
}
