import { NextResponse } from 'next/server'
import { resolveActor } from '@/lib/admin'
import { getRoomMembers, ensureRoomMembers, setMemberAgreed, isRoomMember } from '@/lib/collab-network'
import { demoRoomMembers, setDemoAgreed, isDemoRoomId } from '@/lib/demo-collab'

// GET — members of a group room + their "I'm in" status (members only).
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const requested = new URL(req.url).searchParams.get('memberId')
  const actor = await resolveActor(requested)
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  if (actor.isDemo && isDemoRoomId(id)) {
    return NextResponse.json({ members: demoRoomMembers(id, actor.memberId) })
  }
  if (!(await isRoomMember(id, actor.memberId))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }
  return NextResponse.json({ members: await ensureRoomMembers(id) })
}

// PATCH — set the caller's own agreement ("I'm in"). Body: { agreed, memberId? }
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const actor = await resolveActor(body.memberId)
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  if (actor.isDemo && isDemoRoomId(id)) {
    setDemoAgreed(id, actor.memberId, !!body.agreed)
    return NextResponse.json({ members: demoRoomMembers(id, actor.memberId) })
  }
  if (!(await isRoomMember(id, actor.memberId))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }
  await ensureRoomMembers(id) // seed 1:1 rows if missing
  await setMemberAgreed(id, actor.memberId, !!body.agreed)
  return NextResponse.json({ members: await getRoomMembers(id) })
}
