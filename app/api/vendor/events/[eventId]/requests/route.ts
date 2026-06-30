import { NextResponse } from 'next/server'
import { resolveActor } from '@/lib/admin'
import { isDemoMode } from '@/lib/demo-admin'
import { demoJoinRequests, isDemoEventId } from '@/lib/demo-organize'
import { getVendorEventById } from '@/lib/vendor-connect'
import { getJoinRequests, setJoinRequestStatus } from '@/lib/event-join'

async function hostOnly(eventId: string) {
  const event = await getVendorEventById(eventId)
  if (!event) return { error: 'Event not found' as const, status: 404 }
  const actor = await resolveActor(event.member_id)
  if (!actor || actor.memberId !== event.member_id) {
    return { error: 'Unauthorized' as const, status: 403 }
  }
  return { event }
}

// GET — "add my business" requests for this event. Host only.
export async function GET(_req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params
  if (isDemoMode() && isDemoEventId(eventId)) return NextResponse.json({ requests: demoJoinRequests(eventId) })
  const a = await hostOnly(eventId)
  if ('error' in a) return NextResponse.json({ error: a.error }, { status: a.status })
  return NextResponse.json({ requests: await getJoinRequests(eventId) })
}

// PATCH — mark a request added/dismissed. Body: { id, status }
export async function PATCH(req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId: eid } = await params
  if (isDemoMode() && isDemoEventId(eid)) return NextResponse.json({ ok: true, demo: true })
  const { eventId } = await params
  const a = await hostOnly(eventId)
  if ('error' in a) return NextResponse.json({ error: a.error }, { status: a.status })

  const body = await req.json().catch(() => ({}))
  const status = ['added', 'dismissed', 'pending'].includes(body.status) ? body.status : null
  if (!body.id || !status) return NextResponse.json({ error: 'Missing id or status' }, { status: 400 })

  await setJoinRequestStatus(String(body.id), eventId, status)
  return NextResponse.json({ ok: true })
}
