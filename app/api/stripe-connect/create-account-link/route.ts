import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe-server'
import { getVendorConnectAccount } from '@/lib/vendor-connect'
import { resolveActor } from '@/lib/admin'
import { SITE_URL } from '@/lib/seo'

// Fresh onboarding link for an account that already exists (Stripe's links are
// single-use and expire). Member comes from the session, not the body.

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const requested = (body as { memberId?: string }).memberId ?? null

    const actor = await resolveActor(requested)
    if (!actor) return NextResponse.json({ error: 'Not authorized' }, { status: 401 })
    if (actor.isDemo) return NextResponse.json({ error: 'Not available in demo' }, { status: 403 })

    const vendorAccount = await getVendorConnectAccount(actor.memberId)
    if (!vendorAccount) {
      return NextResponse.json({ error: 'No Stripe Connect account found for this vendor' }, { status: 404 })
    }

    const accountLink = await stripe.accountLinks.create({
      account: vendorAccount.stripe_account_id,
      return_url: `${SITE_URL}/vendor/integrations?stripe_connect=success`,
      refresh_url: `${SITE_URL}/vendor/integrations?stripe_connect=refresh`,
      type: 'account_onboarding',
    })

    return NextResponse.json({ onboardingUrl: accountLink.url })
  } catch (error: unknown) {
    console.error('create-account-link error:', error)
    const message = error instanceof Error ? error.message : 'Failed to create account link'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
