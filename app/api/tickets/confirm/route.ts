import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe-server'
import { getVendorEventById } from '@/lib/vendor-connect'
import { issuePaidTickets, linesFromMetadata } from '@/lib/ticket-issue'
import { rateLimit } from '@/lib/rate-limit'

// Turn a succeeded PaymentIntent into tickets. Called by the browser right
// after payment so the buyer sees their QR immediately; the Stripe webhook does
// the same thing independently, in case the browser closed first.
//
// Everything issued comes from the PaymentIntent's own metadata, which the
// server wrote at purchase time — the request body carries only the intent id,
// so a caller can't ask for tickets that weren't paid for.
export async function POST(request: Request) {
  const limited = rateLimit({ req: request, name: 'ticket-confirm', id: null, limit: 30, windowMs: 60_000, ipLimit: 30 })
  if (limited) return limited

  try {
    const { paymentIntentId }: { paymentIntentId: string } = await request.json()
    if (!paymentIntentId) return NextResponse.json({ error: 'paymentIntentId is required' }, { status: 400 })

    const pi = await stripe.paymentIntents.retrieve(paymentIntentId)
    if (pi.status !== 'succeeded') {
      return NextResponse.json({ error: `Payment not succeeded. Status: ${pi.status}` }, { status: 400 })
    }

    const meta = pi.metadata ?? {}
    if (meta.kind !== 'tickets') {
      return NextResponse.json({ error: 'Not a ticket payment' }, { status: 400 })
    }

    const event = await getVendorEventById(meta.eventId ?? '')
    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 })

    const lines = linesFromMetadata(meta.lines)
    if (lines.length === 0) return NextResponse.json({ error: 'Nothing to issue' }, { status: 400 })

    const { tickets, orderNumber } = await issuePaidTickets({
      event,
      lines,
      buyerEmail: meta.buyerEmail ?? pi.receipt_email ?? '',
      buyerName: meta.buyerName || null,
      attendeeId: meta.attendeeId ?? '',
      paymentIntentId,
      subtotalCents: parseInt(meta.subtotal_cents ?? '0', 10) || pi.amount,
      platformFeeCents: parseInt(meta.platform_fee_cents ?? '0', 10),
      vendorAmountCents: parseInt(meta.vendor_amount_cents ?? '0', 10),
    })

    return NextResponse.json({
      success: true,
      orderNumber,
      eventId: event.id,
      tickets: tickets.map((t) => ({ token: t.token, code: t.code, typeName: t.ticket_type_name })),
    })
  } catch (error: unknown) {
    console.error('ticket confirm error:', error)
    const message = error instanceof Error ? error.message : 'Failed to issue tickets'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
