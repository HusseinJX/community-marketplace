import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe-server'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { paymentIntentId }: { paymentIntentId: string } = body

    if (!paymentIntentId) {
      return NextResponse.json({ error: 'paymentIntentId is required' }, { status: 400 })
    }

    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)

    if (paymentIntent.status !== 'succeeded') {
      return NextResponse.json(
        { error: `Payment not succeeded. Status: ${paymentIntent.status}` },
        { status: 400 }
      )
    }

    const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`

    return NextResponse.json({
      success: true,
      orderNumber,
    })
  } catch (error: unknown) {
    console.error('confirm-payment error:', error)
    const message = error instanceof Error ? error.message : 'Failed to confirm payment'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
