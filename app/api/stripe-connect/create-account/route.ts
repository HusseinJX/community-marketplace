import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe-server'
import { setVendorConnectAccount } from '@/lib/vendor-connect'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { memberId, memberName, email }: { memberId: string; memberName: string; email: string } = body

    if (!memberId || !memberName || !email) {
      return NextResponse.json({ error: 'memberId, memberName, and email are required' }, { status: 400 })
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    const account = await stripe.accounts.create({
      type: 'express',
      country: 'US',
      email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      metadata: {
        memberId,
        memberName,
      },
    })

    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      return_url: `${baseUrl}/members/${memberId}?stripe_connect=success`,
      refresh_url: `${baseUrl}/members/${memberId}?stripe_connect=refresh`,
      type: 'account_onboarding',
    })

    await setVendorConnectAccount(memberId, {
      stripeAccountId: account.id,
      status: 'pending',
      onboardingUrl: accountLink.url,
    })

    return NextResponse.json({
      accountId: account.id,
      onboardingUrl: accountLink.url,
      status: 'pending',
    })
  } catch (error: unknown) {
    console.error('create-account error:', error)
    const message = error instanceof Error ? error.message : 'Failed to create Stripe Connect account'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
