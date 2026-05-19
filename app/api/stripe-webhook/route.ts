import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe-server'
import { updateVendorConnectStatus, createOrder, getOrderByPaymentIntent, updateOrderStatus } from '@/lib/vendor-connect'
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
        const existing = await getOrderByPaymentIntent(pi.id)
        if (!existing) {
          const meta = pi.metadata ?? {}
          const items = meta.items ? JSON.parse(meta.items) : []
          await createOrder({
            order_number: generateOrderNumber(),
            payment_intent_id: pi.id,
            member_id: meta.memberId ?? '',
            buyer_email: pi.receipt_email ?? null,
            status: 'paid',
            items,
            subtotal_cents: parseInt(meta.subtotal_cents ?? '0', 10) || pi.amount,
            platform_fee_cents: parseInt(meta.platform_fee_cents ?? '0', 10),
            vendor_amount_cents: parseInt(meta.vendor_amount_cents ?? '0', 10),
            delivery_requested: false,
            uber_delivery_id: null,
            uber_tracking_url: null,
          })
          console.log(`Order created via webhook for payment_intent ${pi.id}`)
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
