import { NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { stripe, calculateFees } from '@/lib/stripe-server'
import { getVendorEventById, getVendorConnectAccount } from '@/lib/vendor-connect'
import { getAvailability, guestAttendeeId } from '@/lib/tickets'
import { issueFreeTickets } from '@/lib/ticket-issue'
import { rateLimit } from '@/lib/rate-limit'

interface RequestedLine {
  ticketTypeId: string
  quantity: number
}

// Start a ticket purchase.
//
// Deliberately guest-friendly: an account is never required to buy, only an
// email address, because the emailed ticket link is the access path for someone
// who will never make an account. Signed-in buyers get the same tickets, plus
// they show up in /tickets.
//
// Free tiers skip Stripe entirely and are issued right here — a $0 PaymentIntent
// isn't a thing, and routing a free RSVP through a payment form to charge
// nothing would be a worse experience for the majority case.
export async function POST(request: Request) {
  const limited = rateLimit({ req: request, name: 'ticket-purchase', id: null, limit: 20, windowMs: 60_000, ipLimit: 20 })
  if (limited) return limited

  try {
    const body = await request.json()
    const { eventId, lines, email, name }: { eventId: string; lines: RequestedLine[]; email?: string; name?: string } = body

    if (!eventId || !Array.isArray(lines) || lines.length === 0) {
      return NextResponse.json({ error: 'eventId and lines are required' }, { status: 400 })
    }

    const event = await getVendorEventById(eventId)
    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 })

    const { userId } = await auth()
    const user = userId ? await currentUser() : null
    const buyerEmail = (email || user?.emailAddresses?.[0]?.emailAddress || '').trim().toLowerCase()
    const buyerName = (name || user?.firstName || user?.username || '').trim() || null

    // The email is the ticket's delivery address AND a guest's only handle on
    // their own purchase, so it's required even when the tickets are free.
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(buyerEmail)) {
      return NextResponse.json({ error: 'A valid email is required to send the tickets.' }, { status: 400 })
    }

    // ── Price and stock come from the DB, never the request ──────────────────
    // Same rule the shop learned the hard way: a client-supplied price is a
    // free-shopping bug. The browser sends ids and quantities only.
    const availability = await getAvailability(eventId)
    const priced: { typeId: string; typeName: string; priceCents: number; quantity: number }[] = []

    for (const line of lines) {
      const type = availability.find((t) => t.id === line.ticketTypeId)
      if (!type) return NextResponse.json({ error: 'TICKET_UNAVAILABLE', message: 'That ticket is no longer on sale.' }, { status: 400 })
      const qty = Math.floor(line.quantity || 0)
      if (qty <= 0) continue
      if (type.closed) {
        return NextResponse.json({ error: 'SALES_CLOSED', message: `Sales for "${type.name}" have ended.` }, { status: 400 })
      }
      if (qty > type.max_per_order) {
        return NextResponse.json({ error: 'TOO_MANY', message: `Up to ${type.max_per_order} "${type.name}" per order.` }, { status: 400 })
      }
      if (type.remaining != null && qty > type.remaining) {
        return NextResponse.json(
          { error: 'SOLD_OUT', message: type.remaining === 0 ? `"${type.name}" is sold out.` : `Only ${type.remaining} "${type.name}" left.` },
          { status: 409 }
        )
      }
      priced.push({ typeId: type.id, typeName: type.name, priceCents: type.price_cents, quantity: qty })
    }

    if (priced.length === 0) return NextResponse.json({ error: 'Pick at least one ticket.' }, { status: 400 })

    const totalTickets = priced.reduce((n, l) => n + l.quantity, 0)
    const itemsCents = priced.reduce((sum, l) => sum + l.priceCents * l.quantity, 0)

    // Capacity is the room's limit and outranks any single tier's stock — two
    // tiers of 100 in a venue that holds 120 must not sell 200 tickets.
    if (event.capacity != null) {
      const live = availability.reduce((n, t) => n + t.sold, 0)
      if (live + totalTickets > event.capacity) {
        const left = Math.max(0, event.capacity - live)
        return NextResponse.json(
          { error: 'SOLD_OUT', message: left === 0 ? 'This event is full.' : `Only ${left} spots left.` },
          { status: 409 }
        )
      }
    }

    const attendeeId = userId ?? guestAttendeeId(buyerEmail)

    // ── Free: no Stripe, issue now ───────────────────────────────────────────
    if (itemsCents === 0) {
      const first = priced[0]
      const tickets = await issueFreeTickets({
        event,
        quantity: totalTickets,
        ticketTypeId: first.typeId,
        ticketTypeName: first.typeName,
        buyerEmail,
        buyerName,
        attendeeId,
      })
      return NextResponse.json({
        free: true,
        tickets: tickets.map((t) => ({ token: t.token, code: t.code, typeName: t.ticket_type_name })),
      })
    }

    // ── Paid: same Connect rails as the shop ─────────────────────────────────
    const vendorAccount = await getVendorConnectAccount(event.member_id)
    if (!vendorAccount?.stripe_account_id || vendorAccount.status !== 'active') {
      return NextResponse.json(
        { error: 'STRIPE_CONNECT_NOT_SETUP', message: 'This organizer hasn\'t finished setting up payments yet.' },
        { status: 400 }
      )
    }

    const { platformFee, vendorAmount } = calculateFees(itemsCents)

    const paymentIntent = await stripe.paymentIntents.create({
      amount: itemsCents,
      currency: 'usd',
      application_fee_amount: platformFee,
      transfer_data: { destination: vendorAccount.stripe_account_id },
      // Stripe emails its own receipt here, which is separate from our ticket
      // email — a receipt proves payment, a ticket gets you in the door.
      receipt_email: buyerEmail,
      metadata: {
        kind: 'tickets',
        memberId: event.member_id,
        eventId: event.id,
        eventTitle: event.title.slice(0, 200),
        attendeeId,
        buyerEmail,
        buyerName: buyerName ?? '',
        // The issuance instruction, frozen server-side at payment time. Both
        // the browser confirm and the webhook read tickets out of THIS, so
        // neither can be talked into minting something that wasn't paid for.
        lines: JSON.stringify(priced.map((l) => ({ t: l.typeId, n: l.typeName.slice(0, 40), p: l.priceCents, q: l.quantity }))),
        subtotal_cents: String(itemsCents),
        platform_fee_cents: String(platformFee),
        vendor_amount_cents: String(vendorAmount),
        fulfillment_type: 'ticket',
      },
    })

    return NextResponse.json({
      free: false,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: itemsCents,
      platformFee,
      vendorAmount,
      ticketCount: totalTickets,
    })
  } catch (error: unknown) {
    console.error('ticket purchase error:', error)
    const message = error instanceof Error ? error.message : 'Failed to start ticket checkout'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
