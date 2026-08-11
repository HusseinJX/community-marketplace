import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe-server'
import { updateVendorConnectStatus, createOrder, getOrderByPaymentIntent, updateOrderStatus, getVendorEventById, type FulfillmentType } from '@/lib/vendor-connect'
import { issuePaidTickets, linesFromMetadata } from '@/lib/ticket-issue'
import { cancelTicketsForPaymentIntent } from '@/lib/tickets'
import { deliverDigitalItems } from '@/lib/digital-deliver'
import { pushOrderToPrintify } from '@/lib/printify-commerce'
import { pushOrderToStore } from '@/lib/composio-commerce'
import Stripe from 'stripe'

function generateOrderNumber() {
  return `ORD-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`
}

export async function POST(request: Request) {
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')

  if (!sig) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET is not set')
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Webhook signature verification failed'
    console.error('Webhook signature verification failed:', message)
    return NextResponse.json({ error: `Webhook Error: ${message}` }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'account.updated': {
        const account = event.data.object as Stripe.Account
        const status = account.details_submitted && account.charges_enabled ? 'active' : 'pending'
        await updateVendorConnectStatus(account.id, status)
        console.log(`Updated Stripe Connect status for account ${account.id}: ${status}`)
        break
      }
      case 'payment_intent.succeeded': {
        const pi = event.data.object as Stripe.PaymentIntent
        const meta = pi.metadata ?? {}

        // Ticket sales are a different shape of order — no catalog items, no
        // fulfillment, and the goods are minted rather than shipped. This is
        // the durability path for them: if the buyer's browser closed before
        // /api/tickets/confirm ran, the tickets still get issued and emailed.
        // issuePaidTickets is idempotent against that route (the order row's
        // unique payment_intent_id is the lock), so both landing is fine.
        if (meta.kind === 'tickets') {
          const ticketEvent = await getVendorEventById(meta.eventId ?? '')
          const lines = linesFromMetadata(meta.lines)
          if (ticketEvent && lines.length > 0) {
            await issuePaidTickets({
              event: ticketEvent,
              lines,
              buyerEmail: meta.buyerEmail ?? pi.receipt_email ?? '',
              buyerName: meta.buyerName || null,
              attendeeId: meta.attendeeId ?? '',
              paymentIntentId: pi.id,
              subtotalCents: parseInt(meta.subtotal_cents ?? '0', 10) || pi.amount,
              platformFeeCents: parseInt(meta.platform_fee_cents ?? '0', 10),
              vendorAmountCents: parseInt(meta.vendor_amount_cents ?? '0', 10),
            })
            console.log(`Tickets issued via webhook for payment_intent ${pi.id}`)
          } else {
            console.error(`Ticket payment ${pi.id} has no resolvable event/lines`)
          }
          break
        }

        const existing = await getOrderByPaymentIntent(pi.id)
        if (!existing) {
          const items = meta.items ? JSON.parse(meta.items) : []
          // Must read the SAME fulfillment metadata as confirm-payment. This is
          // the durability path (fires when the browser never called
          // confirm-payment), so hardcoding pickup here would silently turn a
          // delivery the buyer paid for into a pickup — with the fee collected
          // and no courier ever dispatched.
          const fulfillmentType = (['pickup', 'delivery', 'ticket', 'digital', 'service'] as const).includes(
            meta.fulfillment_type as never
          )
            ? (meta.fulfillment_type as FulfillmentType)
            : 'pickup'
          const isDelivery = fulfillmentType === 'delivery'
          // Same read as confirm-payment: uber is the safe default, since it
          // was the only kind of delivery before self-delivery existed.
          const deliveryProvider = isDelivery ? (meta.delivery_provider === 'self' ? 'self' : meta.delivery_provider === 'printify' ? 'printify' : 'uber') : null
          const deliveryFeeCents = parseInt(meta.delivery_fee_cents ?? '0', 10) || 0
          await createOrder({
            order_number: generateOrderNumber(),
            payment_intent_id: pi.id,
            member_id: meta.memberId ?? '',
            buyer_email: pi.receipt_email ?? null,
            status: fulfillmentType === 'digital' ? 'delivered' : 'paid',
            items,
            subtotal_cents: parseInt(meta.subtotal_cents ?? '0', 10) || pi.amount,
            platform_fee_cents: parseInt(meta.platform_fee_cents ?? '0', 10),
            vendor_amount_cents: parseInt(meta.vendor_amount_cents ?? '0', 10),
            fulfillment_type: fulfillmentType,
            delivery_provider: deliveryProvider,
            delivery_requested: isDelivery,
            delivery_address: isDelivery && meta.delivery_address ? JSON.parse(meta.delivery_address) : null,
            delivery_fee_cents: isDelivery ? deliveryFeeCents : null,
            delivery_fee_charged_cents: isDelivery ? deliveryFeeCents : null,
            uber_quote_id: isDelivery ? (meta.uber_quote_id || null) : null,
            uber_delivery_id: null,
            uber_tracking_url: null,
          })
          console.log(`Order created via webhook for payment_intent ${pi.id}`)
          const created = await getOrderByPaymentIntent(pi.id)
          if (created) {
            // Durability path for production too. pushOrderToPrintify is
            // idempotent (our order number is Printify's external_id, so a
            // duplicate is refused rather than printed twice), which is what
            // makes it safe for both this and confirm-payment to call it.
            if (created.delivery_provider === 'printify') await pushOrderToPrintify(created)
            // Durability path for downloads too: if the buyer's browser closed
            // before confirm-payment ran, the links still get emailed.
            await deliverDigitalItems(created, { buyerEmail: pi.receipt_email ?? null })
          }
        }

        // Push the completed order back into the vendor's connected store
        // (Shopify/Square) natively via Composio. Gated inside pushOrderToStore
        // on the vendor having a connected platform. Fire-and-forget — failures
        // are logged, never surfaced to the buyer.
        const memberId = meta.memberId
        if (memberId) {
          const orderToSync = existing ?? (await getOrderByPaymentIntent(pi.id))
          if (orderToSync) {
            pushOrderToStore(memberId, orderToSync).catch(e =>
              console.error('Composio order push failed:', e)
            )
          }
        }
        break
      }

      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge
        if (charge.payment_intent) {
          const order = await getOrderByPaymentIntent(charge.payment_intent as string)
          if (order) {
            await updateOrderStatus(order.id, 'refunded')
            console.log(`Order ${order.order_number} marked refunded`)
          }
          // A refunded ticket must stop working at the door — the QR is still
          // on the buyer's phone and would otherwise scan green.
          await cancelTicketsForPaymentIntent(charge.payment_intent as string, 'refunded')
        }
        break
      }

      default:
        console.log(`Unhandled webhook event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error: unknown) {
    console.error('Webhook processing error:', error)
    const message = error instanceof Error ? error.message : 'Webhook processing failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
