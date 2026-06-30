import { NextResponse } from 'next/server'
import { resolveActor } from '@/lib/admin'
import { acceptInvite, declineInvite } from '@/lib/collab-network'

// PATCH — invitee accepts or declines. Body: { status: 'accepted' | 'declined', memberId? }
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const actor = await resolveActor(body.memberId)
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  // Demo: no write. Accepting just refreshes (a demo room already exists).
  if (actor.isDemo) return NextResponse.json({ ok: true, demo: true })

  try {
    if (body.status === 'accepted') {
      const room = await acceptInvite(id, actor.memberId)
      if (!room) return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
      return NextResponse.json({ ok: true, room })
    }
    if (body.status === 'declined') {
      await declineInvite(id, actor.memberId)
      return NextResponse.json({ ok: true })
    }
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update invite'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
