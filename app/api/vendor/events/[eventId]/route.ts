import { NextResponse } from 'next/server'
import { getVendorEventById } from '@/lib/vendor-connect'

// One event by id, for the collab room's Events tab (view the public card) and
// as the object EventAttendees needs. This is public data — the same event is
// already served at the public page /events/[id] — so no auth: editing goes
// through the resolveActor-gated PATCH /api/events/[memberId], not here.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params
  const event = await getVendorEventById(eventId)
  if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ event })
}
