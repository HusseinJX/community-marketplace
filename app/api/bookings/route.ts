import { NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { createBookingRequest, getBookingsForCustomer, guestCustomerId, cancelBooking } from '@/lib/bookings'
import { notifyMemberUserSafe } from '@/lib/notify'
import { rateLimit } from '@/lib/rate-limit'

// Ask a business for a time.
//
// No account required — booking a haircut shouldn't need one, the same rule as
// buying a ticket. An email is required instead, because a request the business
// answers is worthless if there's no way to tell the customer.
export async function POST(request: Request) {
  const limited = rateLimit({ req: request, name: 'booking-create', id: null, limit: 10, windowMs: 60_000, ipLimit: 10 })
  if (limited) return limited

  try {
    const body = await request.json().catch(() => ({}))
    const memberId = String(body.memberId ?? '').trim()
    if (!memberId) return NextResponse.json({ error: 'memberId is required' }, { status: 400 })

    const { userId } = await auth()
    const user = userId ? await currentUser() : null

    const email = String(body.email ?? user?.emailAddresses?.[0]?.emailAddress ?? '').trim().toLowerCase()
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return NextResponse.json({ error: 'We need an email so they can get back to you.' }, { status: 400 })
    }
    if (!body.requestedDate) {
      return NextResponse.json({ error: 'Pick a day that suits you.' }, { status: 400 })
    }

    const name = String(body.name ?? user?.firstName ?? '').trim() || null

    const booking = await createBookingRequest({
      memberId,
      productId: body.productId ?? null,
      serviceName: body.serviceName ? String(body.serviceName).slice(0, 120) : null,
      customerId: userId ?? guestCustomerId(email),
      customerName: name,
      customerEmail: email,
      customerPhone: body.phone ? String(body.phone).slice(0, 40) : null,
      requestedDate: String(body.requestedDate),
      requestedTime: body.requestedTime ? String(body.requestedTime).slice(0, 60) : null,
      altDate: body.altDate ? String(body.altDate) : null,
      altTime: body.altTime ? String(body.altTime).slice(0, 60) : null,
      note: body.note ? String(body.note) : null,
    })

    // The whole point of the feature: somebody is actually told. The prototype
    // this replaces notified nobody at all.
    void notifyMemberUserSafe(memberId, {
      title: 'New booking request',
      body: `${name || 'Someone'} asked for ${[booking.requested_date, booking.requested_time].filter(Boolean).join(' at ')}`,
      url: '/vendor/bookings',
    })

    return NextResponse.json({ ok: true, id: booking.id })
  } catch (error: unknown) {
    console.error('booking create failed:', error)
    return NextResponse.json({ error: 'Could not send that request. Please try again.' }, { status: 500 })
  }
}

// The signed-in customer's own requests.
export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ bookings: [] }, { status: 401 })
  return NextResponse.json({ bookings: await getBookingsForCustomer(userId) })
}

// A customer standing down their own request.
export async function DELETE(request: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Sign in' }, { status: 401 })
  const id = new URL(request.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
  return NextResponse.json({ ok: await cancelBooking(id, userId) })
}
