import { NextResponse } from 'next/server'
import { resolveActor } from '@/lib/admin'
import { isDemoMode } from '@/lib/demo-admin'
import { demoAttendees, isDemoEventId } from '@/lib/demo-organize'
import { getVendorEventById } from '@/lib/vendor-connect'
import { getAttendees, getGoingCount } from '@/lib/attendees'

// GET — the event's RSVP list + headcount. Host only.
export async function GET(_req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params
  if (isDemoMode() && isDemoEventId(eventId)) return NextResponse.json(demoAttendees(eventId))
  const event = await getVendorEventById(eventId)
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 })

  const actor = await resolveActor(event.member_id)
  if (!actor || actor.memberId !== event.member_id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const [attendees, count] = await Promise.all([getAttendees(eventId), getGoingCount(eventId)])
  return NextResponse.json({ count, capacity: event.capacity ?? null, attendees })
}
