import { NextResponse } from 'next/server'
import { resolveActor } from '@/lib/admin'
import { getMember } from '@/lib/api'
import { createVendorEvent } from '@/lib/vendor-connect'
import { getRoom, isRoomMember, createInvite, setEventInviteStatus, sendMessage, getRoomMembers } from '@/lib/collab-network'

// POST — turn a collab room into an event. The caller becomes the host/owner;
// the other room member is auto-added to the lineup (accepted). They can invite
// more collaborators later via /vendor/organize.
// Body: { title, event_date?, event_time?, location?, role?, memberId? }
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json().catch(() => ({}))

  const actor = await resolveActor(body.memberId)
  if (!actor || !(await isRoomMember(id, actor.memberId))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const title = String(body.title ?? '').trim()
  if (!title) return NextResponse.json({ error: 'An event title is required' }, { status: 400 })

  const room = await getRoom(id)
  if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 })

  // The host = the caller. Collaborators added to the lineup:
  //  - group room → everyone who's "in" (agreed), minus the host
  //  - 1:1 room   → the other member
  const host = actor.memberId

  let hostName: string | null = room.member_a === host ? room.member_a_name : room.member_b_name
  if (!hostName) {
    try {
      const v = await getMember(host)
      hostName = (v.member.profile?.businessName as string) || (v.member.profile?.name as string) || 'An organizer'
    } catch {
      hostName = 'An organizer'
    }
  }

  let collaborators: { id: string; name: string | null }[]
  if (room.is_group) {
    collaborators = (await getRoomMembers(id))
      .filter((m) => m.agreed && m.member_id !== host)
      .map((m) => ({ id: m.member_id, name: m.member_name }))
  } else {
    collaborators =
      room.member_a === host
        ? [{ id: room.member_b, name: room.member_b_name }]
        : [{ id: room.member_a, name: room.member_a_name }]
  }

  const event = await createVendorEvent(host, hostName ?? 'An organizer', {
    title,
    event_date: body.event_date ? String(body.event_date) : null,
    event_time: body.event_time ? String(body.event_time) : null,
    location: body.location ? String(body.location) : null,
    active: true,
    source: 'collab',
  })

  // Add each agreed collaborator to the lineup, already accepted.
  const role = String(body.role ?? 'partner')
  await Promise.all(
    collaborators
      .filter((c) => c.id && c.id !== host)
      .map(async (c) => {
        try {
          const inv = await createInvite({
            from_id: host,
            from_name: hostName ?? 'An organizer',
            to_id: c.id,
            to_name: c.name,
            message: `Co-creating "${title}"`,
            scope_type: 'event',
            scope_id: event.id,
            role,
          })
          await setEventInviteStatus(inv.id, event.id, 'accepted')
        } catch {
          // Event exists regardless; collaborators can be re-invited from Organize.
        }
      })
  )
  const addedCount = collaborators.filter((c) => c.id && c.id !== host).length

  // Drop a note in the room so both sides see it.
  try {
    await sendMessage({
      room_id: id,
      sender_id: host,
      sender_name: hostName ?? null,
      text: `📅 Started planning an event together: "${title}". Manage it in Organize.`,
    })
  } catch {
    /* non-fatal */
  }

  return NextResponse.json({ eventId: event.id, added: addedCount })
}
