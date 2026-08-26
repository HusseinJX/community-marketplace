import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { stripe } from '@/lib/stripe-server'
import { syncFromStripeSubscription } from '@/lib/subscriptions'
import { syncMembershipFromStripe, setSubscriberIdentity } from '@/lib/memberships'

export const runtime = 'nodejs'

// Stripe webhook for SUBSCRIPTION lifecycle (separate from the Connect payments
// webhook at /api/stripe-webhook — different signing secret).
//
// TWO KINDS OF SUBSCRIPTION arrive here and they must never be confused:
//   • the platform plan a business pays US for   → `subscriptions`  (lib/subscriptions.ts)
//   • a membership a shopper buys from a BUSINESS → `memberships`   (lib/memberships.ts)
// Membership objects carry `metadata.kind = 'membership'`; everything is routed
// on that. Both handlers also re-check it themselves rather than trusting this
// dispatch, because the cost of a mix-up is cancelling a paying vendor's plan.
const WEBHOOK_SECRET = process.env.STRIPE_SUBSCRIPTION_WEBHOOK_SECRET

export async function POST(req: Request) {
  if (!WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'not_configured' }, { status: 503 })
  }
  const sig = req.headers.get('stripe-signature')
  if (!sig) return NextResponse.json({ error: 'no_signature' }, { status: 400 })

  const body = await req.text()
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, WEBHOOK_SECRET)
  } catch (e) {
    console.error('[billing webhook] bad signature', e)
    return NextResponse.json({ error: 'bad_signature' }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.mode === 'subscription' && session.subscription) {
          const sub = await stripe.subscriptions.retrieve(session.subscription as string)
          if (session.metadata?.kind === 'membership' || sub.metadata?.kind === 'membership') {
            await syncMembershipFromStripe(sub)
            // Name and email come from the Checkout session, not the
            // subscription — this is the only event that carries who typed the
            // card in, and the vendor's member list is unreadable without it.
            await setSubscriberIdentity(sub.id, {
              email: session.customer_details?.email ?? null,
              name: session.customer_details?.name ?? null,
            })
          } else {
            await syncFromStripeSubscription(sub)
          }
        }
        break
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        if (sub.metadata?.kind === 'membership') await syncMembershipFromStripe(sub)
        else await syncFromStripeSubscription(sub)
        break
      }
      default:
        break
    }
  } catch (e) {
    console.error('[billing webhook] handler error', event.type, e)
    return NextResponse.json({ error: 'handler_failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
