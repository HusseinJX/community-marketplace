import type { VendorEvent } from './vendor-connect'
import { createOrderIfAbsent, getOrderByPaymentIntent } from './vendor-connect'
import {
  issueTickets,
  getTicketsByPaymentIntent,
  syncRsvpTickets,
  ticketUrl,
  type IssueLine,
  type Ticket,
} from './tickets'
import { rsvp } from './attendees'
import { sendTicketEmail } from './email'
import { notifyMemberSafe } from './push'
import { SITE_URL } from './seo'

// One place where a ticket becomes real: mint it, put the holder on the
// organizer's attendee list, email it out, tell the organizer.
//
// It lives outside the routes because THREE callers need identical behaviour —
// the free path, the browser's post-payment confirm, and the Stripe webhook's
// durability path. When the shop kept this logic in two places they drifted,
// and a paid delivery silently became a pickup.

function generateOrderNumber() {
  return `TIX-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`
}

export interface PaidIssueOpts {
  event: VendorEvent
  lines: IssueLine[]
  buyerEmail: string
  buyerName: string | null
  attendeeId: string
  paymentIntentId: string
  subtotalCents: number
  platformFeeCents: number
  vendorAmountCents: number
}

/**
 * Issue tickets for a completed payment. Safe to call from both the browser and
 * the webhook, concurrently.
 *
 * The order row is the lock: `orders.payment_intent_id` is UNIQUE, so exactly
 * one caller inserts it and gets to mint tickets. The loser waits for the
 * winner's rows instead of minting a duplicate set — one payment, one set of
 * tickets, no matter who arrives first.
 */
export async function issuePaidTickets(opts: PaidIssueOpts): Promise<{ tickets: Ticket[]; orderNumber: string; fresh: boolean }> {
  const items = opts.lines.map((l) => ({
    name: l.ticketTypeName ?? 'Ticket',
    qty: l.quantity,
    price_cents: l.priceCents,
  }))

  const order = await createOrderIfAbsent({
    order_number: generateOrderNumber(),
    payment_intent_id: opts.paymentIntentId,
    member_id: opts.event.member_id,
    event_id: opts.event.id,
    buyer_email: opts.buyerEmail,
    status: 'paid',
    items,
    subtotal_cents: opts.subtotalCents,
    platform_fee_cents: opts.platformFeeCents,
    vendor_amount_cents: opts.vendorAmountCents,
    fulfillment_type: 'ticket',
    delivery_requested: false,
    delivery_address: null,
    delivery_fee_cents: null,
    delivery_fee_charged_cents: null,
    uber_quote_id: null,
    uber_delivery_id: null,
    uber_tracking_url: null,
  })

  if (!order) {
    // Someone else is issuing (or already has). Read their tickets back.
    const existing = await waitForTickets(opts.paymentIntentId)
    const prior = await getOrderByPaymentIntent(opts.paymentIntentId)
    return { tickets: existing, orderNumber: prior?.order_number ?? '', fresh: false }
  }

  const tickets = await issueTickets({
    eventId: opts.event.id,
    memberId: opts.event.member_id,
    lines: opts.lines,
    buyerEmail: opts.buyerEmail,
    buyerName: opts.buyerName,
    attendeeId: opts.attendeeId,
    orderId: order.id,
    paymentIntentId: opts.paymentIntentId,
  })

  await afterIssue(opts.event, tickets, opts.buyerEmail, opts.buyerName, opts.attendeeId, true)
  return { tickets, orderNumber: order.order_number, fresh: true }
}

/**
 * Issue free tickets (a $0 tier, or a plain RSVP).
 *
 * Quantity is treated as the holder's DESIRED TOTAL for this event, not an
 * increment — a double-tapped "RSVP for 2" must not admit four people. Growing
 * the number issues the difference; shrinking cancels the newest surplus, so
 * codes already on someone's phone stay valid.
 */
export async function issueFreeTickets(opts: {
  event: VendorEvent
  quantity: number
  ticketTypeId?: string | null
  ticketTypeName?: string | null
  buyerEmail: string | null
  buyerName: string | null
  attendeeId: string
}): Promise<Ticket[]> {
  const before = await countLive(opts.event.id, opts.attendeeId)
  const tickets = await syncRsvpTickets({
    eventId: opts.event.id,
    memberId: opts.event.member_id,
    attendeeId: opts.attendeeId,
    partySize: opts.quantity,
    email: opts.buyerEmail,
    name: opts.buyerName,
    ticketTypeId: opts.ticketTypeId ?? null,
    ticketTypeName: opts.ticketTypeName ?? null,
  })
  const fresh = tickets.length > before
  await afterIssue(opts.event, tickets, opts.buyerEmail, opts.buyerName, opts.attendeeId, fresh)
  return tickets
}

/** Void a holder's tickets for an event (RSVP cancelled). */
export { cancelRsvpTickets } from './tickets'

// ─── Shared tail ─────────────────────────────────────────────────────────────

async function afterIssue(
  event: VendorEvent,
  tickets: Ticket[],
  buyerEmail: string | null,
  buyerName: string | null,
  attendeeId: string,
  fresh: boolean
) {
  const live = tickets.filter((t) => t.status === 'issued' || t.status === 'checked_in')
  const count = live.length

  // Keep the organizer's existing Attendees tab and SMS/email blasts working:
  // they read event_attendees, and a ticket holder is an attendee. party_size
  // is the live ticket count, so the headcount stays true.
  try {
    await rsvp(event.id, {
      attendee_id: attendeeId,
      attendee_name: buyerName,
      attendee_contact: buyerEmail,
      party_size: Math.max(1, count),
    })
  } catch (e) {
    // Never fail a paid purchase over a bookkeeping row — the tickets exist.
    console.error('ticket attendee sync failed:', e)
  }

  if (!fresh || count === 0) return

  if (buyerEmail) {
    void sendTicketEmail({
      to: buyerEmail,
      eventTitle: event.title,
      eventWhen: [event.event_date, event.event_time].filter(Boolean).join(' · ') || null,
      eventWhere: event.location ?? null,
      hostName: event.member_name ?? null,
      tickets: live.map((t) => ({ token: t.token, code: t.code, typeName: t.ticket_type_name })),
      ticketUrlFor: ticketUrl,
      manageUrl: `${SITE_URL}/tickets`,
    }).catch((e) => console.error('ticket email failed:', e))
  }

  const paid = live.some((t) => t.price_cents > 0)
  void notifyMemberSafe(event.member_id, {
    title: paid ? 'Tickets sold' : 'New RSVP',
    body: `${buyerName || 'Someone'} got ${count} ${count === 1 ? 'ticket' : 'tickets'} for "${event.title}"`,
    url: `/vendor/checkin/${event.id}`,
  })
}

async function countLive(eventId: string, attendeeId: string): Promise<number> {
  const { getTicketsForAttendee } = await import('./tickets')
  const all = await getTicketsForAttendee(attendeeId)
  return all.filter((t) => t.event_id === eventId).length
}

/**
 * Wait briefly for the winner of the order-row race to finish minting. Bounded
 * and short: if it hasn't happened in a second the caller returns empty and the
 * buyer sees their tickets on the next load rather than a hang.
 */
async function waitForTickets(paymentIntentId: string): Promise<Ticket[]> {
  for (let i = 0; i < 5; i++) {
    const tickets = await getTicketsByPaymentIntent(paymentIntentId)
    if (tickets.length > 0) return tickets
    await new Promise((r) => setTimeout(r, 200))
  }
  return []
}

/** Parse the issuance instruction frozen into PaymentIntent metadata. */
export function linesFromMetadata(raw: string | undefined): IssueLine[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as { t: string; n: string; p: number; q: number }[]
    return parsed.map((l) => ({
      ticketTypeId: l.t || null,
      ticketTypeName: l.n || null,
      priceCents: Math.max(0, Math.round(l.p || 0)),
      quantity: Math.max(0, Math.round(l.q || 0)),
    }))
  } catch {
    return []
  }
}
