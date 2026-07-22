import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe-server'
import { createOrder, getOrderByPaymentIntent } from '@/lib/vendor-connect'
import { rateLimit } from '@/lib/rate-limit'

function generateOrderNumber() {
  return `ORD-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`
}

export async function POST(request: Request) {
  try {
    // Guest checkout — per-IP guard. The order is built from server-set PI
    // metadata and is idempotent, so this just caps enumeration/abuse.
    const limited = rateLimit({ req: request, name: 'checkout-confirm', id: null, limit: 30, windowMs: 60_000, ipLimit: 30 })
    if (limited) return limited

    const body = await request.json()
    const { paymentIntentId }: { paymentIntentId: string } = body

    if (!paymentIntentId) {
      return NextResponse.json({ error: 'paymentIntentId is required' }, { status: 400 })
    }

    // idempotent — return existing order if already persisted
    const existing = await getOrderByPaymentIntent(paymentIntentId)
    if (existing) {
      return NextResponse.json({ success: true, orderNumber: existing.order_number, orderId: existing.id })
    }

    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)

    if (paymentIntent.status !== 'succeeded') {
      return NextResponse.json(
        { error: `Payment not succeeded. Status: ${paymentIntent.status}` },
        { status: 400 }
      )
    }

    const meta = paymentIntent.metadata ?? {}
    const memberId = meta.memberId ?? ''
    const items = meta.items ? JSON.parse(meta.items) : []
    const subtotalCents = parseInt(meta.subtotal_cents ?? '0', 10) || paymentIntent.amount
    const platformFeeCents = parseInt(meta.platform_fee_cents ?? '0', 10)
    const vendorAmountCents = parseInt(meta.vendor_amount_cents ?? '0', 10)

    // Fulfillment was decided before payment, so the PaymentIntent is the record
    // of what the buyer chose AND what they were charged for delivery. Defaults
    // to pickup: intents created before this change carry no fulfillment_type,
    // and pickup is the safe read (it never dispatches a courier).
    const fulfillmentType = meta.fulfillment_type === 'delivery' ? 'delivery' : 'pickup'
    const deliveryFeeCents = parseInt(meta.delivery_fee_cents ?? '0', 10) || 0
    const deliveryAddress = meta.delivery_address ? JSON.parse(meta.delivery_address) : null
    const isDelivery = fulfillmentType === 'delivery'

    const order = await createOrder({
      order_number: generateOrderNumber(),
      payment_intent_id: paymentIntentId,
      member_id: memberId,
      buyer_email: paymentIntent.receipt_email ?? null,
      status: 'paid',
      items,
      subtotal_cents: subtotalCents,
      platform_fee_cents: platformFeeCents,
      vendor_amount_cents: vendorAmountCents,
      fulfillment_type: fulfillmentType,
      // delivery_requested predates fulfillment_type; keep it in step so the
      // vendor dashboard and dispatch guard keep working off either.
      delivery_requested: isDelivery,
      delivery_address: isDelivery ? deliveryAddress : null,
      delivery_fee_cents: isDelivery ? deliveryFeeCents : null,
      // The receipt: what they actually paid. dispatch re-quotes and the fresh
      // fee may differ — this stays frozen so the delta is measurable.
      delivery_fee_charged_cents: isDelivery ? deliveryFeeCents : null,
      uber_quote_id: isDelivery ? (meta.uber_quote_id || null) : null,
      uber_delivery_id: null,
      uber_tracking_url: null,
    })

    return NextResponse.json({ success: true, orderNumber: order.order_number, orderId: order.id })
  } catch (error: unknown) {
    console.error('confirm-payment error:', error)
    const message = error instanceof Error ? error.message : 'Failed to confirm payment'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
