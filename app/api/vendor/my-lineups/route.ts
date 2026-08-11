import { NextResponse } from 'next/server'
import { resolveReadActor } from '@/lib/admin'
import { getEventsImOn } from '@/lib/collab-network'
import { sfToday } from '@/lib/sf-date'

// The events this business is ON the lineup for — the vendor's side of an
// organizer's market or festival.
//
// Deliberately NOT plan-gated. Hosting an event is an Organizer capability, but
// *being invited to one* is available on Free (`networkReceive`), so gating this
// would hide the answer from exactly the vendors most likely to need it.
//
// resolveReadActor, not resolveActor: this is read-only, so the admin demo can
// see the shape too.
export async function GET(request: Request) {
  const requested = new URL(request.url).searchParams.get('memberId')
  const actor = await resolveReadActor(requested)
  if (!actor) return NextResponse.json({ events: [] }, { status: 401 })

  const rows = await getEventsImOn(actor.memberId)

  // Finished events drop off, judged on a STATED end date where there is one —
  // the same rule the public feed uses, so a two-week market doesn't vanish on
  // its opening day. City-local, never UTC (see lib/sf-date).
  const today = sfToday()
  const upcoming = rows.filter(({ event }) => (event.end_date ?? event.event_date ?? '9999') >= today)

  return NextResponse.json({
    events: upcoming.map(({ event, role, hostName }) => ({
      id: event.id,
      title: event.title,
      date: event.event_date,
      time: event.event_time,
      location: event.location,
      poster: event.poster_image_url,
      role,
      hostName: hostName ?? event.member_name,
    })),
  })
}
