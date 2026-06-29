import { NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { getVendorEventById } from '@/lib/vendor-connect'
import { getGoingCount, getMyRsvp, rsvp, cancelRsvp } from '@/lib/attendees'
import { isDemoMode } from '@/lib/demo-admin'

// GET — public RSVP state for an event: total going, capacity, and whether the
// current user is going.
export async function GET(req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params
  const { userId } = await auth()
  const [event, count, mine] = await Promise.all([
    getVendorEventById(eventId),
    getGoingCount(eventId),
    userId ? getMyRsvp(eventId, userId) : Promise.resolve(null),
  ])
  return NextResponse.json({
    count,
    capacity: event?.capacity ?? null,
    going: mine?.status === 'going',
    partySize: mine?.party_size ?? 1,
  })
}

// POST — RSVP. Body: { partySize? }. Any signed-in user; demo allows anon.
export async function POST(req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params
  const { userId } = await auth()
  if (!userId && !isDemoMode()) {
    return NextResponse.json({ error: 'Sign in to RSVP' }, { status: 401 })
  }
  const attendeeId = userId ?? 'demo'

  const body = await req.json().catch(() => ({}))
  const partySize = Math.max(1, Math.min(Number(body.partySize) || 1, 20))

  // Capacity check (excludes this attendee's prior count so editing works).
  const event = await getVendorEventById(eventId)
  if (event?.capacity != null) {
    const [total, existing] = await Promise.all([getGoingCount(eventId), getMyRsvp(eventId, attendeeId)])
    const others = total - (existing?.status === 'going' ? existing.party_size : 0)
    if (others + partySize > event.capacity) {
      return NextResponse.json({ error: 'This event is full', full: true }, { status: 409 })
    }
  }

  let name: string | null = null
  let contact: string | null = null
  if (userId) {
    const u = await currentUser()
    name = u?.firstName || u?.username || null
    contact = u?.emailAddresses?.[0]?.emailAddress ?? null
  }
  // A phone (for text reminders) takes priority as the reachable contact.
  const phone = String(body.phone ?? '').trim()
  if (phone) contact = phone

  try {
    await rsvp(eventId, { attendee_id: attendeeId, attendee_name: name, attendee_contact: contact, party_size: partySize })
    return NextResponse.json({ going: true, count: await getGoingCount(eventId) })
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
    return NextResponse.json({ going: false, count: await getGoingCount(eventId) })
  } catch {
    return NextResponse.json({ going: false })
  }
}
