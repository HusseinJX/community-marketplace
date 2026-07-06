import { NextResponse } from 'next/server'
import { resolveActor } from '@/lib/admin'
import { getMember } from '@/lib/api'
import { createInvite, getInvitesFor } from '@/lib/collab-network'
import { demoInvites } from '@/lib/demo-collab'
import { gateCapability } from '@/lib/gate'

// GET — the acting member's invites (incoming + outgoing).
export async function GET(req: Request) {
  const requested = new URL(req.url).searchParams.get('memberId')
  const actor = await resolveActor(requested)
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (actor.isDemo) return NextResponse.json(demoInvites(actor.memberId))
  return NextResponse.json(await getInvitesFor(actor.memberId))
}

// POST — send a collaboration invite. Body: { memberId?, toId, toName?, message? }
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const actor = await resolveActor(body.memberId)
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const toId = String(body.toId ?? '').trim()
  if (!toId) return NextResponse.json({ error: 'Pick someone to invite' }, { status: 400 })
  if (toId === actor.memberId) return NextResponse.json({ error: "Can't invite yourself" }, { status: 400 })
  // Demo: don't write; the client optimistically marks "Invited".
  if (actor.isDemo) return NextResponse.json({ invite: null, demo: true })
  // Sending collaboration invites is a Pro capability (Members can only receive).
  const gated = await gateCapability(actor.memberId, 'networkInitiate', { bypass: actor.isAdmin })
  if (gated) return gated

  let fromName: string | null = null
  let toName: string | null = body.toName ? String(body.toName) : null
  try {
    const v = await getMember(actor.memberId)
    fromName = (v.member.profile?.businessName as string) || (v.member.profile?.name as string) || null
  } catch {
    /* non-fatal */
  }
  if (!toName) {
    try {
      const t = await getMember(toId)
      toName = (t.member.profile?.name as string) || null
    } catch {
      /* non-fatal */
    }
  }

  try {
    const invite = await createInvite({
      from_id: actor.memberId,
      from_name: fromName,
      to_id: toId,
      to_name: toName,
      message: body.message ? String(body.message).trim() : null,
      role: body.role ? String(body.role) : null,
      occasion_id: body.occasionId ? String(body.occasionId) : null,
      occasion_label: body.occasionLabel ? String(body.occasionLabel).trim() : null,
    })
    return NextResponse.json({ invite })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to send invite'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
