import { NextResponse } from 'next/server'
import { resolveActor } from '@/lib/admin'
import { getMember } from '@/lib/api'
import { getRoomsFor, createGroupRoom, getOrCreateOccasionGroupRoom, createInvite } from '@/lib/collab-network'
import { demoRooms } from '@/lib/demo-collab'

// GET — the acting member's collab rooms.
export async function GET(req: Request) {
  const requested = new URL(req.url).searchParams.get('memberId')
  const actor = await resolveActor(requested)
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (actor.isDemo) return NextResponse.json({ rooms: demoRooms(actor.memberId) })
  return NextResponse.json({ rooms: await getRoomsFor(actor.memberId) })
}

// POST — start a multi-party group collab. Body:
// { title, invitees: [{ id, name? }], memberId? }
// The caller owns the room and is "in" by default; each invitee gets a group
// invite that, on accept, joins this room.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const actor = await resolveActor(body.memberId)
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const title = String(body.title ?? '').trim()
  if (!title) return NextResponse.json({ error: 'Name your collaboration' }, { status: 400 })
  // Demo: don't write; report a plausible invited count for the success toast.
  if (actor.isDemo) {
    const n = Array.isArray(body.invitees) ? body.invitees.filter((v: { id?: string }) => v?.id).length : 0
    return NextResponse.json({ roomId: 'demo-room-new', invited: n, demo: true })
  }

  const invitees: { id: string; name?: string }[] = Array.isArray(body.invitees)
    ? body.invitees.filter((v: { id?: string }) => v?.id && v.id !== actor.memberId)
    : []

  let ownerName: string | null = null
  try {
    const v = await getMember(actor.memberId)
    ownerName = (v.member.profile?.businessName as string) || (v.member.profile?.name as string) || null
  } catch {
    /* non-fatal */
  }

  // Within a named collaboration, group invites all land in its single room.
  const occasionId = body.occasionId ? String(body.occasionId) : null
  const occasionLabel = body.occasionLabel ? String(body.occasionLabel) : null
  const room = occasionId
    ? await getOrCreateOccasionGroupRoom({
        owner_id: actor.memberId,
        owner_name: ownerName,
        occasion_id: occasionId,
        occasion_label: occasionLabel,
        title,
      })
    : await createGroupRoom({ owner_id: actor.memberId, owner_name: ownerName, title })

  await Promise.all(
    invitees.map((v) =>
      createInvite({
        from_id: actor.memberId,
        from_name: ownerName,
        to_id: v.id,
        to_name: v.name ?? null,
        message: body.message ? String(body.message).trim() : `Collaborate on "${title}"`,
        room_id: room.id,
        role: body.role ? String(body.role) : null,
        occasion_id: occasionId,
        occasion_label: occasionLabel,
      }).catch(() => null)
    )
  )

  return NextResponse.json({ roomId: room.id, invited: invitees.length })
}
