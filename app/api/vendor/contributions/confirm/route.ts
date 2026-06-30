import { NextResponse } from 'next/server'
import { resolveActor } from '@/lib/admin'
import { setContributionStatus } from '@/lib/contributions'

// POST — a community org confirms or declines a gift addressed to it. Body:
// { id, status: 'confirmed' | 'declined', memberId? (admin acting as org) }
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const actor = await resolveActor(body.memberId)
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = String(body.id ?? '')
  const status = body.status === 'confirmed' ? 'confirmed' : body.status === 'declined' ? 'declined' : null
  if (!id || !status) {
    return NextResponse.json({ error: 'Missing id or status' }, { status: 400 })
  }

  try {
    // Scoped by the actor's member id — only the addressed org can confirm.
    await setContributionStatus(id, actor.memberId, status)
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
