import { createClient } from '@supabase/supabase-js'
import type Stripe from 'stripe'
import { stripe } from '@/lib/stripe-server'
import type { Plan } from '@/lib/entitlements'

// Stripe-backed platform subscription plumbing: create the customer, start a
// Checkout session for a plan, open the Billing Portal, and sync status from
// webhook events into the `subscriptions` table (see migration 20260706130000).

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!
)

const SITE_URL =
  process.env.MARKETPLACE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

// Which Stripe Price id maps to which self-serve plan.
function priceIdFor(plan: Plan): string | null {
  if (plan === 'member') return process.env.STRIPE_PRICE_MEMBER || null
  if (plan === 'pro') return process.env.STRIPE_PRICE_PRO || null
  return null
}

export function planFromPriceId(priceId: string | null | undefined): Plan {
  if (priceId && priceId === process.env.STRIPE_PRICE_PRO) return 'pro'
  if (priceId && priceId === process.env.STRIPE_PRICE_MEMBER) return 'member'
  return 'free'
}

export interface SubscriptionRow {
  member_id: string
  plan: Plan
  status: string
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  current_period_end: string | null
}

export async function getSubscription(memberId: string): Promise<SubscriptionRow | null> {
  const { data } = await supabase.from('subscriptions').select('*').eq('member_id', memberId).single()
  return (data as SubscriptionRow) ?? null
}

async function upsertSubscription(row: Partial<SubscriptionRow> & { member_id: string }) {
  await supabase
    .from('subscriptions')
    .upsert({ ...row, updated_at: new Date().toISOString() }, { onConflict: 'member_id' })
}

// Get or create the Stripe customer for a member, persisting the id.
async function ensureCustomer(memberId: string, email?: string | null): Promise<string> {
  const existing = await getSubscription(memberId)
  if (existing?.stripe_customer_id) return existing.stripe_customer_id
  const customer = await stripe.customers.create({
    email: email || undefined,
    metadata: { member_id: memberId },
  })
  await upsertSubscription({
    member_id: memberId,
    plan: existing?.plan ?? 'free',
    status: existing?.status ?? 'inactive',
    stripe_customer_id: customer.id,
  })
  return customer.id
}

/** Start a subscription Checkout session for `plan`; returns the redirect URL. */
export async function createCheckoutSession(
  memberId: string,
  plan: Plan,
  email?: string | null
): Promise<{ url: string } | { error: string }> {
  const price = priceIdFor(plan)
  if (!price) return { error: 'plan_unavailable' }
  const customer = await ensureCustomer(memberId, email)
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer,
    line_items: [{ price, quantity: 1 }],
    // member_id also on the customer + subscription metadata for the webhook.
    subscription_data: { metadata: { member_id: memberId } },
    metadata: { member_id: memberId },
    success_url: `${SITE_URL}/vendor/billing?upgraded=1`,
    cancel_url: `${SITE_URL}/vendor/billing?canceled=1`,
    allow_promotion_codes: true,
  })
  return session.url ? { url: session.url } : { error: 'session_failed' }
}

/** Open the Stripe Billing Portal so the member can manage/cancel their plan. */
export async function createPortalSession(memberId: string): Promise<{ url: string } | { error: string }> {
  const sub = await getSubscription(memberId)
  if (!sub?.stripe_customer_id) return { error: 'no_customer' }
  const portal = await stripe.billingPortal.sessions.create({
    customer: sub.stripe_customer_id,
    return_url: `${SITE_URL}/vendor/billing`,
  })
  return { url: portal.url }
}

// ── Webhook sync ──────────────────────────────────────────────────────────────

async function memberIdForCustomer(customerId: string): Promise<string | null> {
  const { data } = await supabase
    .from('subscriptions')
    .select('member_id')
    .eq('stripe_customer_id', customerId)
    .single()
  return (data as { member_id: string } | null)?.member_id ?? null
}

/** Apply a Stripe Subscription object to our table (plan/status/period). */
export async function syncFromStripeSubscription(sub: Stripe.Subscription): Promise<void> {
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id
  const memberId =
    (sub.metadata?.member_id as string | undefined) || (await memberIdForCustomer(customerId))
  if (!memberId) return

  const priceId = sub.items.data[0]?.price?.id
  const canceled = sub.status === 'canceled' || sub.cancel_at_period_end === true && sub.status !== 'active'
  const plan = canceled ? 'free' : planFromPriceId(priceId)
  const periodEnd = sub.items.data[0]?.current_period_end ?? (sub as unknown as { current_period_end?: number }).current_period_end

  await upsertSubscription({
    member_id: memberId,
    plan,
    status: sub.status,
    stripe_customer_id: customerId,
    stripe_subscription_id: sub.id,
    current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
  })

  // Pro/enterprise unlock the premium AI-image quota; downgrades revoke it.
  const premium = plan === 'pro' || plan === 'enterprise'
  await supabase
    .from('ai_image_credits')
    .upsert({ member_id: memberId, premium, updated_at: new Date().toISOString() }, { onConflict: 'member_id' })
}
