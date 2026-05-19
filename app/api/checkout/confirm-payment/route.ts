import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe-server'
import { createOrder, getOrderByPaymentIntent } from '@/lib/vendor-connect'

function generateOrderNumber() {
  return `ORD-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`
}

export async function POST(request: Request) {
  try {
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
      delivery_requested: false,
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
