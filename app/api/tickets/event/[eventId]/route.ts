import { NextResponse } from 'next/server'
import { getVendorEventById } from '@/lib/vendor-connect'
import { getConnectPayoutState } from '@/lib/connect-status'
import { getAvailability, publicTicketType } from '@/lib/tickets'

// Public: what's on sale for this event, and whether the host can take money.
//
// `payable` is deliberately part of the public payload. An organizer can define
// a $20 tier before finishing Stripe onboarding, and the buyer must be told
// "tickets aren't on sale yet" up front rather than at the payment step.
export async function GET(_req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params
  const event = await getVendorEventById(eventId)
  if (!event) return NextResponse.json({ types: [], payable: false })

  const types = await getAvailability(eventId)
  const hasPaid = types.some((t) => t.price_cents > 0)
  const payouts = hasPaid ? await getConnectPayoutState(event.member_id) : null

  return NextResponse.json({
    eventId,
    title: event.title,
    types: types.map(publicTicketType),
    payable: !hasPaid || (payouts?.active ?? false),
  })
}
