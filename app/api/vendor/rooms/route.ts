import { NextResponse } from 'next/server'
import { resolveActor } from '@/lib/admin'
import { getMember } from '@/lib/api'
import { getRoomsFor, createGroupRoom, createInvite } from '@/lib/collab-network'

// GET — the acting member's collab rooms.
export async function GET(req: Request) {
  const requested = new URL(req.url).searchParams.get('memberId')
  const actor = await resolveActor(requested)
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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

  const room = await createGroupRoom({ owner_id: actor.memberId, owner_name: ownerName, title })

  await Promise.all(
    invitees.map((v) =>
      createInvite({
        from_id: actor.memberId,
        from_name: ownerName,
        to_id: v.id,
        to_name: v.name ?? null,
        message: `Collaborate on "${title}"`,
        room_id: room.id,
      }).catch(() => null)
    )
  )

  return NextResponse.json({ roomId: room.id, invited: invitees.length })
}
