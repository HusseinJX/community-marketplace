import { NextResponse } from 'next/server'
import { resolveActor } from '@/lib/admin'
import { getVendorEventById } from '@/lib/vendor-connect'
import { checkInTicket, undoCheckIn, getTicketsForEvent, getIssuedCount, getCheckedInCount } from '@/lib/tickets'

// The door. Host only — an organizer can only admit people to their own event.

async function host(eventId: string) {
  const event = await getVendorEventById(eventId)
  if (!event) return { error: NextResponse.json({ error: 'Event not found' }, { status: 404 }) }
  const actor = await resolveActor(event.member_id)
  if (!actor || actor.memberId !== event.member_id) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 403 }) }
  }
  return { event, actor }
}

// GET — live door stats + the guest list, for the "search by name" fallback
// when someone turns up with no phone and no email.
export async function GET(_req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params
  const h = await host(eventId)
  if ('error' in h) return h.error

  const [tickets, issued, checkedIn] = await Promise.all([
    getTicketsForEvent(eventId),
    getIssuedCount(eventId),
    getCheckedInCount(eventId),
  ])

  return NextResponse.json({
    event: { id: h.event.id, title: h.event.title, date: h.event.event_date, time: h.event.event_time },
    issued,
    checkedIn,
    // The door staff get the short code (which they may need to read back) but
    // never the token — a leaked guest list must not become a set of usable
    // tickets.
    tickets: tickets
      .filter((t) => t.status === 'issued' || t.status === 'checked_in')
      .map((t) => ({
        id: t.id,
        code: t.code,
        name: t.buyer_name,
        email: t.buyer_email,
        typeName: t.ticket_type_name,
        status: t.status,
        checkedInAt: t.checked_in_at,
      })),
  })
}

// POST — admit someone. Body: { value } (a scanned QR URL, a raw token, or a
// typed short code).
export async function POST(req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params
  const h = await host(eventId)
  if ('error' in h) return h.error
  if (h.actor.isDemo) {
    return NextResponse.json({ ok: true, demo: true, message: 'Demo — nothing was recorded.' })
  }

  const body = await req.json().catch(() => ({}))
  const value = String(body.value ?? '').trim()
  if (!value) return NextResponse.json({ error: 'Nothing scanned' }, { status: 400 })

  const result = await checkInTicket(value, eventId, h.event.member_id, h.actor.userId)
  const checkedIn = await getCheckedInCount(eventId)

  if (result.ok) {
    return NextResponse.json({
      ok: true,
      checkedIn,
      ticket: { code: result.ticket.code, name: result.ticket.buyer_name, typeName: result.ticket.ticket_type_name },
    })
  }

  // Every refusal says WHY in words the person on the door can act on. A second
  // scan in particular must never look like a success.
  const message =
    result.reason === 'already_in'
      ? `Already checked in${result.ticket?.checked_in_at ? ` at ${new Date(result.ticket.checked_in_at).toLocaleTimeString()}` : ''}`
      : result.reason === 'wrong_event'
        ? 'This ticket is for a different event'
        : result.reason === 'void'
          ? 'This ticket was refunded or cancelled'
          : 'Ticket not found'

  return NextResponse.json({
    ok: false,
    reason: result.reason,
    message,
    checkedIn,
    ticket: result.ticket
      ? { code: result.ticket.code, name: result.ticket.buyer_name, typeName: result.ticket.ticket_type_name }
      : null,
  })
}

// DELETE — undo an admission (wrong person scanned).
export async function DELETE(req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params
  const h = await host(eventId)
  if ('error' in h) return h.error
  if (h.actor.isDemo) return NextResponse.json({ ok: true, demo: true })

  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  await undoCheckIn(id, h.event.member_id)
  return NextResponse.json({ ok: true, checkedIn: await getCheckedInCount(eventId) })
}
