import { NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { getVendorEventById } from '@/lib/vendor-connect'
import { getGoingCount, getMyRsvp, rsvp, cancelRsvp } from '@/lib/attendees'
import { isDemoMode } from '@/lib/demo-admin'
import { issueFreeTickets } from '@/lib/ticket-issue'
import { getAvailability, guestAttendeeId, cancelRsvpTickets, getTicketsForAttendee } from '@/lib/tickets'

// GET — public RSVP state for an event: total going, capacity, and whether the
// current user is going.
export async function GET(req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params
  const { userId } = await auth()
  const [event, count, mine, types, myTickets] = await Promise.all([
    getVendorEventById(eventId),
    getGoingCount(eventId),
    userId ? getMyRsvp(eventId, userId) : Promise.resolve(null),
    getAvailability(eventId),
    userId ? getTicketsForAttendee(userId) : Promise.resolve([]),
  ])
  return NextResponse.json({
    count,
    capacity: event?.capacity ?? null,
    going: mine?.status === 'going',
    partySize: mine?.party_size ?? 1,
    // When the organizer has defined tiers, the ticket box takes over from the
    // plain RSVP button — the client needs to know which one to render, and
    // only the server knows whether tiers exist.
    hasTicketTypes: types.length > 0,
    // The holder's own tickets, so the button can become "View ticket" instead
    // of pretending nothing was issued.
    myTickets: myTickets
      .filter((t) => t.event_id === eventId)
      .map((t) => ({ token: t.token, code: t.code })),
  })
}

// POST — RSVP. Body: { partySize?, email?, name?, phone? }.
//
// Signed in, or a guest who gives an email — an account is not a prerequisite
// for going to a free event, and the RSVP now issues a real scannable ticket,
// which has to reach the guest somehow. Demo still allows fully anonymous.
export async function POST(req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params
  const { userId } = await auth()

  const body = await req.json().catch(() => ({}))
  const partySize = Math.max(1, Math.min(Number(body.partySize) || 1, 20))
  const guestEmail = String(body.email ?? '').trim().toLowerCase()
  const guestValid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(guestEmail)

  if (!userId && !guestValid && !isDemoMode()) {
    return NextResponse.json({ error: 'Sign in or give an email to RSVP' }, { status: 401 })
  }
  const attendeeId = userId ?? (guestValid ? guestAttendeeId(guestEmail) : 'demo')

  // Capacity check (excludes this attendee's prior count so editing works).
  const event = await getVendorEventById(eventId)
  if (event?.capacity != null) {
    const [total, existing] = await Promise.all([getGoingCount(eventId), getMyRsvp(eventId, attendeeId)])
    const others = total - (existing?.status === 'going' ? existing.party_size : 0)
    if (others + partySize > event.capacity) {
      return NextResponse.json({ error: 'This event is full', full: true }, { status: 409 })
    }
  }

  let name: string | null = String(body.name ?? '').trim() || null
  let email: string | null = guestValid ? guestEmail : null
  let contact: string | null = email
  if (userId) {
    const u = await currentUser()
    name = name || u?.firstName || u?.username || null
    email = email || u?.emailAddresses?.[0]?.emailAddress || null
    contact = email
  }
  // A phone (for text reminders) takes priority as the reachable contact — it's
  // what the organizer's SMS blast reads. The email is kept separately because
  // that's where the ticket goes.
  const phone = String(body.phone ?? '').trim()
  if (phone) contact = phone

  try {
    await rsvp(eventId, { attendee_id: attendeeId, attendee_name: name, attendee_contact: contact, party_size: partySize })

    // An RSVP mints real tickets — one per head — so a free event can be
    // scanned at the door exactly like a paid one. issueFreeTickets owns the
    // ticket email and the organizer push from here on, which is why the old
    // inline notify only remains for the no-event-row case.
    let tickets: { token: string; code: string }[] = []
    if (event) {
      const issued = await issueFreeTickets({
        event,
        quantity: partySize,
        buyerEmail: email,
        buyerName: name,
        attendeeId,
      })
      tickets = issued.map((t) => ({ token: t.token, code: t.code }))
    }

    return NextResponse.json({ going: true, count: await getGoingCount(eventId), tickets })
  } catch (err) {
    if (isDemoMode()) return NextResponse.json({ going: true, demo: true })
    const message = err instanceof Error ? err.message : 'Failed to RSVP'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// DELETE — cancel RSVP.
export async function DELETE(req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params
  const { userId } = await auth()
  if (!userId && !isDemoMode()) {
    return NextResponse.json({ error: 'Sign in' }, { status: 401 })
  }
  const attendeeId = userId ?? 'demo'
  try {
    await cancelRsvp(eventId, attendeeId)
    // Void the tickets too, or a cancelled RSVP still scans green at the door.
    await cancelRsvpTickets(eventId, attendeeId)
    return NextResponse.json({ going: false, count: await getGoingCount(eventId) })
  } catch {
    return NextResponse.json({ going: false })
  }
}
