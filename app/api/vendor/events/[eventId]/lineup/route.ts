import { NextResponse } from 'next/server'
import { resolveActor } from '@/lib/admin'
import { isDemoMode } from '@/lib/demo-admin'
import { demoMemberId } from '@/lib/demo-server'
import { demoEvents, demoLineup, isDemoEventId } from '@/lib/demo-organize'
import { getVendorEventById } from '@/lib/vendor-connect'
import { createInvite, getEventInvites, setEventInviteStatus } from '@/lib/collab-network'

// GET — the event's lineup (all event-scoped invites, any status). Host only.
export async function GET(req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params
  if (isDemoMode() && isDemoEventId(eventId)) {
    const m = await demoMemberId()
    const event = demoEvents(m).find((e) => e.id === eventId)
    return NextResponse.json({ event, lineup: demoLineup(eventId, m) })
  }
  const event = await getVendorEventById(eventId)
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 })

  const actor = await resolveActor(event.member_id)
  if (!actor || actor.memberId !== event.member_id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }
  return NextResponse.json({ event, lineup: await getEventInvites(eventId) })
}

// POST — bulk-invite vendors to the lineup. Body:
// { invitees: [{ id, name?, role? }], message? }
export async function POST(req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params
  if (isDemoMode() && isDemoEventId(eventId)) {
    const body = await req.json().catch(() => ({}))
    const n = Array.isArray(body.invitees) ? body.invitees.filter((v: { id?: string }) => v?.id).length : 0
    return NextResponse.json({ invited: n, demo: true })
  }
  const event = await getVendorEventById(eventId)
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 })

  const actor = await resolveActor(event.member_id)
  if (!actor || actor.memberId !== event.member_id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const invitees: { id: string; name?: string; role?: string }[] = Array.isArray(body.invitees)
    ? body.invitees
    : []
  if (invitees.length === 0) {
    return NextResponse.json({ error: 'No vendors selected' }, { status: 400 })
  }

  const hostName = event.member_name || 'An organizer'
  const message = String(body.message ?? '').trim() || `Join the vendor lineup for "${event.title}"`

  const created = await Promise.all(
    invitees
      .filter((v) => v.id && v.id !== event.member_id)
      .map((v) =>
        createInvite({
          from_id: event.member_id,
          from_name: hostName,
          to_id: v.id,
          to_name: v.name ?? null,
          message,
          scope_type: 'event',
          scope_id: eventId,
          role: v.role ?? 'vendor',
        }).catch(() => null)
      )
  )

  return NextResponse.json({ invited: created.filter(Boolean).length })
}

// PATCH — organizer approves/declines a lineup entry (e.g. a self-join request).
// Body: { id, status: 'accepted' | 'declined' }
export async function PATCH(req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params
  if (isDemoMode() && isDemoEventId(eventId)) return NextResponse.json({ ok: true, demo: true })
  const event = await getVendorEventById(eventId)
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 })

  const actor = await resolveActor(event.member_id)
  if (!actor || actor.memberId !== event.member_id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const status = body.status === 'accepted' ? 'accepted' : body.status === 'declined' ? 'declined' : null
  if (!body.id || !status) return NextResponse.json({ error: 'Missing id or status' }, { status: 400 })

  await setEventInviteStatus(String(body.id), eventId, status)
  return NextResponse.json({ ok: true })
}
