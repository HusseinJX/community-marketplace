import { NextResponse } from 'next/server'
import { resolveActor } from '@/lib/admin'
import { getRoomMembers, ensureRoomMembers, setMemberAgreed, isRoomMember, getRoom, getRoomRoster } from '@/lib/collab-network'
import { demoRoomMembers, setDemoAgreed, isDemoRoomId, demoRoomEventId } from '@/lib/demo-collab'

// The room roster, and the one switch on it: "I'm in".
//
// Until the event is created, "I'm in 👍" is yours to flip — that's the point of
// it. Creating the event LOCKS it: the lineup was built from whoever was in at
// that moment, and the host has announced a real thing with a real list. Letting
// someone quietly flip themselves in afterwards would put a business on a public
// event page the host never agreed to. So once event_id is set, PATCH is refused
// HERE, not just hidden in the UI, and getting on means asking the host — the
// same pending self-join the event's public join link creates.

/** Demo rooms carry their event in the fixtures; mirror the real lock. */
function demoRoster(roomId: string, memberId: string) {
  const eventId = demoRoomEventId(roomId)
  const members = demoRoomMembers(roomId, memberId).map((m) => ({
    ...m,
    // Same rule as the real thing: the lineup froze at who was in.
    lineup: eventId ? (m.agreed ? ('accepted' as const) : null) : null,
  }))
  return { members, eventId }
}

// GET — members of a group room, their "I'm in" status, and (once the event
// exists) where each stands on the lineup. Members only.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const requested = new URL(req.url).searchParams.get('memberId')
  const actor = await resolveActor(requested)
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  if (actor.isDemo && isDemoRoomId(id)) {
    return NextResponse.json(demoRoster(id, actor.memberId))
  }
  if (!(await isRoomMember(id, actor.memberId))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }
  return NextResponse.json(await getRoomRoster(id))
}

// PATCH — set the caller's own agreement ("I'm in"). Body: { agreed, memberId? }
// Refused once the event is scheduled: the lineup is locked (see above).
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const actor = await resolveActor(body.memberId)
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const locked = (eventId: string) =>
    NextResponse.json(
      { error: 'The event is scheduled — the lineup is locked. Ask the host to add you.', locked: true, eventId },
      { status: 409 },
    )

  if (actor.isDemo && isDemoRoomId(id)) {
    const demoEvent = demoRoomEventId(id)
    if (demoEvent) return locked(demoEvent)
    setDemoAgreed(id, actor.memberId, !!body.agreed)
    return NextResponse.json(demoRoster(id, actor.memberId))
  }
  if (!(await isRoomMember(id, actor.memberId))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const room = await getRoom(id)
  if (room?.event_id) return locked(room.event_id)

  await ensureRoomMembers(id) // seed 1:1 rows if missing
  await setMemberAgreed(id, actor.memberId, !!body.agreed)
  return NextResponse.json({ members: await getRoomMembers(id), eventId: null })
}
