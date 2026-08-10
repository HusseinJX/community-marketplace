import { NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { getTicketsForAttendee, linkTicketsToAccount } from '@/lib/tickets'
import { getVendorEventById } from '@/lib/vendor-connect'

// Everything the signed-in person holds — upcoming and past, so "events I've
// attended" is just this list read backwards.
export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ tickets: [] }, { status: 401 })

  // Someone who bought as a guest and made an account afterwards should find
  // those tickets here. Claiming on read (rather than at sign-up) means it also
  // works for accounts that already existed before the purchase.
  const user = await currentUser()
  for (const addr of user?.emailAddresses ?? []) {
    if (addr.emailAddress) await linkTicketsToAccount(addr.emailAddress, userId)
  }

  const tickets = await getTicketsForAttendee(userId)
  const eventIds = [...new Set(tickets.map((t) => t.event_id))]
  const events = await Promise.all(eventIds.map((id) => getVendorEventById(id)))
  const byId = new Map(events.filter(Boolean).map((e) => [e!.id, e!]))

  return NextResponse.json({
    tickets: tickets.map((t) => {
      const e = byId.get(t.event_id)
      return {
        token: t.token,
        code: t.code,
        typeName: t.ticket_type_name,
        status: t.status,
        checkedInAt: t.checked_in_at,
        priceCents: t.price_cents,
        event: e
          ? { id: e.id, title: e.title, date: e.event_date, time: e.event_time, location: e.location, hostName: e.member_name, poster: e.poster_image_url }
          : { id: t.event_id, title: 'Event', date: null, time: null, location: null, hostName: null, poster: null },
      }
    }),
  })
}
