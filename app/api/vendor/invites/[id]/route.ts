import { NextResponse } from 'next/server'
import { resolveActor } from '@/lib/admin'
import { acceptInvite, declineInvite, getInvite } from '@/lib/collab-network'
import { notifyMemberUserSafe } from '@/lib/notify'

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
      // Resolve the invite first so we can notify the sender (accept clears state).
      const invite = await getInvite(id)
      const room = await acceptInvite(id, actor.memberId)
      // Event-scoped invites return no room but are a valid accept.
      if (!room && invite?.scope_type !== 'event') {
        return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
      }
      if (invite) {
        void notifyMemberUserSafe(invite.from_id, {
          title: 'Invite accepted',
          body: invite.to_name ? `${invite.to_name} accepted your invite` : 'Your collaboration invite was accepted',
          url: room ? '/vendor/messages?tab=collabs' : '/vendor/organize',
        })
      }
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
