import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { stripe } from '@/lib/stripe-server'
import { syncFromStripeSubscription } from '@/lib/subscriptions'

export const runtime = 'nodejs'

// Stripe webhook for SUBSCRIPTION lifecycle (separate from the Connect payments
// webhook at /api/stripe-webhook — different signing secret). Keeps the
// `subscriptions` table in sync with Stripe.
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
          await syncFromStripeSubscription(sub)
        }
        break
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        await syncFromStripeSubscription(event.data.object as Stripe.Subscription)
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
