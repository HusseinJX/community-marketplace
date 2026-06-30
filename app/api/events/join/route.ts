import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getVendorEventById } from '@/lib/vendor-connect'
import { createInvite } from '@/lib/collab-network'
import { createJoinRequest } from '@/lib/event-join'
import { isDemoMode } from '@/lib/demo-admin'

// POST — public event join. `eventId` comes in the body (not the path) so this
// doesn't collide with the `app/api/events/[memberId]` slug. Two modes:
//  - { eventId, memberId, memberName } → claim a slot for an existing listing
//    (PENDING self-join lineup entry the organizer approves; from_id === to_id).
//  - { eventId, request: { name, category?, contact?, note? } } → "add my business"
//    for a vendor not yet in the directory.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const eventId = String(body.eventId ?? '').trim()
  if (!eventId) return NextResponse.json({ error: 'Missing event' }, { status: 400 })
  const event = await getVendorEventById(eventId)
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 })

  // Mode B — not-listed request.
  if (body.request) {
    const name = String(body.request.name ?? '').trim()
    if (!name) return NextResponse.json({ error: 'Business name required' }, { status: 400 })
    await createJoinRequest({
      event_id: eventId,
      name,
      category: body.request.category ?? null,
      contact: body.request.contact ?? null,
      note: body.request.note ?? null,
    })
    return NextResponse.json({ ok: true, kind: 'request' })
  }

  // Mode A — self-join an existing listing. Require sign-in (demo allows anon).
  const { userId } = await auth()
  if (!userId && !isDemoMode()) {
    return NextResponse.json({ error: 'Sign in to join' }, { status: 401 })
  }
  const memberId = String(body.memberId ?? '').trim()
  if (!memberId) return NextResponse.json({ error: 'Pick your business' }, { status: 400 })

  await createInvite({
    from_id: memberId, // self-join: from === to
    from_name: body.memberName ?? null,
    to_id: memberId,
    to_name: body.memberName ?? null,
    message: 'Requested to join via the event link',
    scope_type: 'event',
    scope_id: eventId,
    role: 'vendor',
  })
  return NextResponse.json({ ok: true, kind: 'join' })
}
