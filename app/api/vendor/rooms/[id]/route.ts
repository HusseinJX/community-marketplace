import { NextResponse } from 'next/server'
import { resolveActor } from '@/lib/admin'
import { getMember } from '@/lib/api'
import { getMessages, sendMessage, isRoomMember, ensureRoomMembers } from '@/lib/collab-network'
import { demoMessages, addDemoMessage, isDemoRoomId } from '@/lib/demo-collab'
import { notifyMemberSafe } from '@/lib/push'
import { screen } from '@/lib/ai-moderation'
import { logModerationEvent, attachModerationContentId } from '@/lib/moderation'

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

  // AI screening. A collab room is a private 1:1 between two businesses, so the
  // held-for-review verdict behaves differently here than on a public post:
  // holding a message back would break a live conversation over a score nobody
  // has looked at yet. So `review` DELIVERS and flags for a moderator, and only
  // `block` stops the message. Public content gets the cautious treatment;
  // private conversation gets the honest one.
  const verdict = await screen({ text })
  let heldEventId: string | null = null
  if (verdict.action !== 'allow') {
    heldEventId = await logModerationEvent({
      surface: 'chat',
      authorId: actor.memberId,
      action: verdict.action,
      categories: verdict.categories,
      scores: verdict.scores,
      text,
    })
    if (verdict.action === 'block') {
      return NextResponse.json(
        { error: "That message wasn't sent — it looks like it breaks our content rules.", blocked: true },
        { status: 422 },
      )
    }
  }

  let senderName: string | null = null
  try {
    const v = await getMember(actor.memberId)
    senderName = (v.member.profile?.businessName as string) || (v.member.profile?.name as string) || null
  } catch {
    /* non-fatal */
  }

  const message = await sendMessage({ room_id: id, sender_id: actor.memberId, sender_name: senderName, text })
  // A flagged-but-delivered message: point the log row at the message a
  // moderator will have to read in context.
  if (heldEventId) void attachModerationContentId(heldEventId, message.id)

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
