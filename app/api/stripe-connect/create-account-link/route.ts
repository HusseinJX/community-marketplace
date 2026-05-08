import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe-server'
import { getVendorConnectAccount } from '@/lib/vendor-connect'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { memberId }: { memberId: string } = body

    if (!memberId) {
      return NextResponse.json({ error: 'memberId is required' }, { status: 400 })
    }

    const vendorAccount = await getVendorConnectAccount(memberId)

    if (!vendorAccount) {
      return NextResponse.json({ error: 'No Stripe Connect account found for this vendor' }, { status: 404 })
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    const accountLink = await stripe.accountLinks.create({
      account: vendorAccount.stripe_account_id,
      return_url: `${baseUrl}/members/${memberId}?stripe_connect=success`,
      refresh_url: `${baseUrl}/members/${memberId}?stripe_connect=refresh`,
      type: 'account_onboarding',
    })

    return NextResponse.json({ onboardingUrl: accountLink.url })
  } catch (error: unknown) {
    console.error('create-account-link error:', error)
    const message = error instanceof Error ? error.message : 'Failed to create account link'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
