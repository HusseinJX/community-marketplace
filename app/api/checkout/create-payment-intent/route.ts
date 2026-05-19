import { NextResponse } from 'next/server'
import { stripe, calculateFees } from '@/lib/stripe-server'
import { getVendorConnectAccount } from '@/lib/vendor-connect'

interface CartItem {
  name: string
  memberId: string
  price: number
  quantity: number
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { items, memberId }: { items: CartItem[]; memberId: string } = body

    if (!items?.length || !memberId) {
      return NextResponse.json({ error: 'items and memberId are required' }, { status: 400 })
    }

    const vendorAccount = await getVendorConnectAccount(memberId)

    if (!vendorAccount || !vendorAccount.stripe_account_id) {
      return NextResponse.json(
        { error: 'STRIPE_CONNECT_NOT_SETUP', message: 'This vendor has not set up payments yet.' },
        { status: 400 }
      )
    }

    if (vendorAccount.status !== 'active') {
      return NextResponse.json(
        { error: 'STRIPE_CONNECT_NOT_SETUP', message: 'This vendor\'s payment account is not yet active.' },
        { status: 400 }
      )
    }

    const totalCents = items.reduce((sum, item) => sum + item.price * item.quantity, 0)
    const { platformFee, vendorAmount } = calculateFees(totalCents)

    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalCents,
      currency: 'usd',
      application_fee_amount: platformFee,
      transfer_data: {
        destination: vendorAccount.stripe_account_id,
      },
      metadata: {
        memberId,
        items: JSON.stringify(items.map(i => ({ name: i.name, qty: i.quantity, price_cents: i.price }))),
        subtotal_cents: String(totalCents),
        platform_fee_cents: String(platformFee),
        vendor_amount_cents: String(vendorAmount),
      },
    })

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: totalCents,
      platformFee,
      vendorAmount,
    })
  } catch (error: unknown) {
    console.error('create-payment-intent error:', error)
    const message = error instanceof Error ? error.message : 'Failed to create payment intent'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
