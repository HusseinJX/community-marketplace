import { NextResponse } from 'next/server'
import { resolveActor } from '@/lib/admin'
import { getMember } from '@/lib/api'
import { getMessages, sendMessage, isRoomMember, ensureRoomMembers } from '@/lib/collab-network'
import { demoMessages, addDemoMessage, isDemoRoomId } from '@/lib/demo-collab'
import { notifyMemberSafe } from '@/lib/push'

// GET — messages in a room (members only).
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const requested = new URL(req.url).searchParams.get('memberId')
  const actor = await resolveActor(requested)
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  if (actor.isDemo && isDemoRoomId(id)) {
    return NextResponse.json({ messages: demoMessages(id, actor.memberId) })
  }
  if (!(await isRoomMember(id, actor.memberId))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }
  return NextResponse.json({ messages: await getMessages(id) })
}

// POST — send a message (members only). Body: { text, memberId? }
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const actor = await resolveActor(body.memberId)
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  const text = String(body.text ?? '').trim()
  if (!text) return NextResponse.json({ error: 'Empty message' }, { status: 400 })
  // Demo: store in process-local memory so it sticks for the session (no DB).
  if (actor.isDemo && isDemoRoomId(id)) {
    return NextResponse.json({ message: addDemoMessage(id, actor.memberId, text), demo: true })
  }
  if (!(await isRoomMember(id, actor.memberId))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  let senderName: string | null = null
  try {
    const v = await getMember(actor.memberId)
    senderName = (v.member.profile?.businessName as string) || (v.member.profile?.name as string) || null
  } catch {
    /* non-fatal */
  }

  const message = await sendMessage({ room_id: id, sender_id: actor.memberId, sender_name: senderName, text })

  // Notify every other room member (1:1 rooms are seeded lazily). Best-effort.
  void ensureRoomMembers(id)
    .then((members) =>
      Promise.all(
        members
          .filter((m) => m.member_id !== actor.memberId)
          .map((m) =>
            notifyMemberSafe(m.member_id, {
              title: senderName ? `Message from ${senderName}` : 'New message',
              body: text.length > 120 ? `${text.slice(0, 117)}…` : text,
              url: '/vendor/messages?tab=collabs',
            })
          )
      )
    )
    .catch(() => {})

  return NextResponse.json({ message })
}
