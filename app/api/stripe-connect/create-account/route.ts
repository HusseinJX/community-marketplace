import { NextResponse } from 'next/server'
import { currentUser } from '@clerk/nextjs/server'
import { stripe } from '@/lib/stripe-server'
import { setVendorConnectAccount, getVendorConnectAccount } from '@/lib/vendor-connect'
import { resolveActor, isAdmin } from '@/lib/admin'
import { gateCapability } from '@/lib/gate'
import { getMember } from '@/lib/api'
import { SITE_URL } from '@/lib/seo'

// Creates the vendor's Stripe Express account and returns a hosted onboarding
// link. The member is resolved from the signed-in user — never from the body:
// memberId/email in the body would let anyone open a Connect account against
// someone else's business.

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const requested = (body as { memberId?: string }).memberId ?? null

    const actor = await resolveActor(requested)
    if (!actor) return NextResponse.json({ error: 'Not authorized' }, { status: 401 })
    if (actor.isDemo) return NextResponse.json({ error: 'Not available in demo' }, { status: 403 })

    const { memberId } = actor
    const gated = await gateCapability(memberId, 'commerce', { bypass: isAdmin(actor.userId) })
    if (gated) return gated

    // Reuse the account if one exists — a second accounts.create would orphan the
    // first and lose whatever onboarding the vendor had already completed.
    const existing = await getVendorConnectAccount(memberId)
    const returnUrl = `${SITE_URL}/vendor/integrations?stripe_connect=success`
    const refreshUrl = `${SITE_URL}/vendor/integrations?stripe_connect=refresh`

    if (existing) {
      const link = await stripe.accountLinks.create({
        account: existing.stripe_account_id,
        return_url: returnUrl,
        refresh_url: refreshUrl,
        type: 'account_onboarding',
      })
      return NextResponse.json({
        accountId: existing.stripe_account_id,
        onboardingUrl: link.url,
        status: existing.status,
      })
    }

    // Stripe requires an email on the account. The Clerk user's email is the one
    // we can actually vouch for; the member name is for the Stripe dashboard.
    let memberName = 'Local business'
    try {
      const m = await getMember(memberId)
      const p = (m as { member?: { profile?: { businessName?: string; name?: string } } })?.member?.profile
      memberName = p?.businessName || p?.name || memberName
    } catch {
      /* connector unavailable → generic name, onboarding still works */
    }

    // From Clerk, not the body — the body's email is caller-controlled and would
    // land on a Stripe account we're vouching for.
    const clerkUser = await currentUser()
    const email = clerkUser?.emailAddresses?.[0]?.emailAddress
    if (!email) {
      return NextResponse.json({ error: 'No email on your account' }, { status: 400 })
    }

    const account = await stripe.accounts.create({
      type: 'express',
      country: 'US',
      email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      metadata: { memberId, memberName },
    })

    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      return_url: returnUrl,
      refresh_url: refreshUrl,
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
