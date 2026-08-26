import { createClient } from '@supabase/supabase-js'
import type Stripe from 'stripe'
import { stripe, PLATFORM_FEE } from '@/lib/stripe-server'

// A business's OWN membership product, sold to its customers — the recurring
// cousin of a shop sale. Not to be confused with lib/subscriptions.ts, which is
// the platform plan a business pays US for. Both are Stripe subscriptions; the
// `kind: membership` metadata below is what keeps the two webhooks apart, and
// lib/subscriptions.ts refuses anything carrying it.
//
// Money moves exactly like a one-off sale: a DESTINATION charge, so the customer
// belongs to the platform (one card on file across every business a person
// joins, one portal) and each invoice transfers to that vendor's Connect account
// with our 5% held back. Same `PLATFORM_FEE` constant as the shop — memberships
// are not a second pricing regime.
//
// ⚠️ PERKS ARE REAL-WORLD ONLY. See the migration header: an in-app digital
// unlock would put this under Apple 3.1.1 (IAP, 30%). Discounts at the counter,
// a free coffee, early access to a real event are 3.1.3(e) goods and services
// used outside the app, which is why this can be a card payment at all.

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!
)

const SITE_URL =
  process.env.MARKETPLACE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

export type BillingInterval = 'month' | 'year'

export interface MembershipPlan {
  id: string
  member_id: string
  name: string
  description: string | null
  price_cents: number
  billing_interval: BillingInterval
  discount_percent: number | null
  perks: string[]
  stripe_price_id: string | null
  active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface Membership {
  id: string
  plan_id: string
  member_id: string
  clerk_user_id: string
  subscriber_email: string | null
  subscriber_name: string | null
  status: string
  cancel_at_period_end: boolean
  current_period_end: string | null
  price_cents: number
  billing_interval: BillingInterval
  stripe_subscription_id: string | null
  stripe_customer_id: string | null
  started_at: string | null
  canceled_at: string | null
  created_at: string
  updated_at: string
}

/**
 * The statuses that mean "give them the perks".
 *
 * `past_due` is deliberately IN: Stripe retries a failed card for days, and
 * turning someone's discount off the hour their bank blinked — while they are
 * standing at the counter — is worse than honouring a week we might not collect.
 * `canceled` is out, and `incomplete` never entered.
 */
export const ENTITLED_STATUSES = ['active', 'trialing', 'past_due'] as const

function planRow(row: Record<string, unknown>): MembershipPlan {
  const perks = row.perks
  return {
    ...(row as unknown as MembershipPlan),
    // jsonb comes back as unknown; anything that isn't a list of strings is
    // shown as no perks rather than crashing a profile page.
    perks: Array.isArray(perks) ? (perks.filter((p) => typeof p === 'string') as string[]) : [],
  }
}

// ── Plans (the vendor's side) ─────────────────────────────────────────────────

/** Every tier a business has, including retired ones. Vendor-facing. */
export async function getPlansByMember(memberId: string): Promise<MembershipPlan[]> {
  const { data } = await supabase
    .from('membership_plans')
    .select('*')
    .eq('member_id', memberId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
  return (data ?? []).map(planRow)
}

/** The tiers a shopper may join. Public-facing, so retired tiers are gone. */
export async function getActivePlansByMember(memberId: string): Promise<MembershipPlan[]> {
  return (await getPlansByMember(memberId)).filter((p) => p.active)
}

export async function getPlan(planId: string): Promise<MembershipPlan | null> {
  const { data } = await supabase.from('membership_plans').select('*').eq('id', planId).single()
  return data ? planRow(data) : null
}

export interface PlanInput {
  name: string
  description?: string | null
  price_cents: number
  billing_interval: BillingInterval
  discount_percent?: number | null
  perks?: string[]
  active?: boolean
  sort_order?: number
}

export async function createPlan(memberId: string, input: PlanInput): Promise<MembershipPlan> {
  const { data, error } = await supabase
    .from('membership_plans')
    .insert({ member_id: memberId, ...normalizeInput(input) })
    .select()
    .single()
  if (error || !data) throw new Error(`Failed to create plan: ${error?.message}`)
  return planRow(data)
}

export async function updatePlan(
  planId: string,
  memberId: string,
  input: Partial<PlanInput>
): Promise<MembershipPlan | null> {
  const patch = normalizeInput(input)
  // Changing the money invalidates the Stripe price: it is immutable, so a new
  // one is minted on the next join. Everyone already subscribed keeps paying the
  // price they agreed to, which is why `memberships.price_cents` is the only
  // honest source for revenue.
  if (patch.price_cents !== undefined || patch.billing_interval !== undefined) {
    patch.stripe_price_id = null
  }
  const { data } = await supabase
    .from('membership_plans')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', planId)
    .eq('member_id', memberId)
    .select()
    .single()
  return data ? planRow(data) : null
}

function normalizeInput(input: Partial<PlanInput>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  if (input.name !== undefined) out.name = String(input.name).slice(0, 120).trim()
  if (input.description !== undefined)
    out.description = input.description ? String(input.description).slice(0, 600) : null
  if (input.price_cents !== undefined) out.price_cents = Math.round(Number(input.price_cents))
  if (input.billing_interval !== undefined)
    out.billing_interval = input.billing_interval === 'year' ? 'year' : 'month'
  if (input.discount_percent !== undefined) {
    const n = Number(input.discount_percent)
    out.discount_percent = Number.isFinite(n) && n >= 1 ? Math.min(100, Math.round(n)) : null
  }
  if (input.perks !== undefined)
    out.perks = (input.perks ?? [])
      .map((p) => String(p).slice(0, 160).trim())
      .filter(Boolean)
      .slice(0, 12)
  if (input.active !== undefined) out.active = !!input.active
  if (input.sort_order !== undefined) out.sort_order = Math.round(Number(input.sort_order) || 0)
  return out
}

/**
 * Retire a tier. Never a delete: rows in `memberships` reference it, and the
 * people on it are still paying. It only leaves the join screen.
 */
export async function retirePlan(planId: string, memberId: string): Promise<boolean> {
  // Reports whether a row actually changed, not merely whether the statement
  // ran. Without the `.select()` an update that matched NOTHING — the wrong
  // business asking — comes back with no error and reads as success.
  const { data, error } = await supabase
    .from('membership_plans')
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq('id', planId)
    .eq('member_id', memberId)
    .select('id')
  return !error && (data?.length ?? 0) > 0
}

// ── Memberships (the shopper's side) ──────────────────────────────────────────

export async function getMembershipsForUser(clerkUserId: string): Promise<Membership[]> {
  const { data } = await supabase
    .from('memberships')
    .select('*')
    .eq('clerk_user_id', clerkUserId)
    .order('created_at', { ascending: false })
  return (data ?? []) as Membership[]
}

export async function getMembersForVendor(memberId: string): Promise<Membership[]> {
  const { data } = await supabase
    .from('memberships')
    .select('*')
    .eq('member_id', memberId)
    .order('created_at', { ascending: false })
  return (data ?? []) as Membership[]
}

export async function getMembership(id: string): Promise<Membership | null> {
  const { data } = await supabase.from('memberships').select('*').eq('id', id).single()
  return (data as Membership) ?? null
}

/**
 * The buyer's live membership with one business, or null.
 *
 * This is what the checkout asks before pricing a basket, so it must stay a
 * single indexed read on the hot path.
 */
export async function activeMembershipFor(
  clerkUserId: string,
  memberId: string
): Promise<Membership | null> {
  const { data } = await supabase
    .from('memberships')
    .select('*')
    .eq('clerk_user_id', clerkUserId)
    .eq('member_id', memberId)
    .in('status', ENTITLED_STATUSES as unknown as string[])
    .maybeSingle()
  return (data as Membership) ?? null
}

/**
 * The discount a buyer is entitled to at this business, 0–100.
 *
 * The SERVER asks this; the client is never trusted to say it holds a
 * membership, for the same reason it is never trusted for a price.
 */
export async function memberDiscountPercent(
  clerkUserId: string | null | undefined,
  memberId: string
): Promise<number> {
  if (!clerkUserId) return 0
  const m = await activeMembershipFor(clerkUserId, memberId)
  if (!m) return 0
  const plan = await getPlan(m.plan_id)
  const pct = plan?.discount_percent ?? 0
  return pct > 0 && pct <= 100 ? pct : 0
}

/** What a discount takes off a subtotal. Rounded once, here, so every caller agrees. */
export function applyDiscount(subtotalCents: number, percent: number): number {
  if (!percent || percent <= 0) return 0
  return Math.min(subtotalCents, Math.round((subtotalCents * percent) / 100))
}

// ── Stripe ────────────────────────────────────────────────────────────────────

/** Mint (and cache) the recurring Price for a tier, on the PLATFORM account. */
async function ensurePrice(plan: MembershipPlan): Promise<string> {
  if (plan.stripe_price_id) return plan.stripe_price_id
  const price = await stripe.prices.create({
    unit_amount: plan.price_cents,
    currency: 'usd',
    recurring: { interval: plan.billing_interval },
    product_data: { name: plan.name },
    metadata: { kind: 'membership', plan_id: plan.id, member_id: plan.member_id },
  })
  await supabase
    .from('membership_plans')
    .update({ stripe_price_id: price.id, updated_at: new Date().toISOString() })
    .eq('id', plan.id)
  return price.id
}

/**
 * The shopper's Stripe customer.
 *
 * Deliberately keyed on the Clerk user and looked up through `memberships` — NOT
 * shared with the platform customer in `subscriptions`. A business owner who
 * joins another business's membership therefore appears as two customers, and no
 * customer-id lookup can ever confuse their plan with their membership.
 */
async function ensureCustomer(
  clerkUserId: string,
  email?: string | null,
  name?: string | null
): Promise<string> {
  const { data } = await supabase
    .from('memberships')
    .select('stripe_customer_id')
    .eq('clerk_user_id', clerkUserId)
    .not('stripe_customer_id', 'is', null)
    .limit(1)
    .maybeSingle()
  const existing = (data as { stripe_customer_id: string } | null)?.stripe_customer_id
  if (existing) return existing

  const customer = await stripe.customers.create({
    email: email || undefined,
    name: name || undefined,
    metadata: { kind: 'membership_subscriber', clerk_user_id: clerkUserId },
  })
  return customer.id
}

export interface JoinResult {
  url?: string
  error?: string
}

/** Start Checkout for a membership. Returns the URL to send the shopper to. */
export async function createJoinSession(opts: {
  plan: MembershipPlan
  clerkUserId: string
  email?: string | null
  name?: string | null
  connectAccountId: string
  returnPath?: string
}): Promise<JoinResult> {
  const { plan, clerkUserId, email, name, connectAccountId } = opts
  if (!plan.active) return { error: 'plan_inactive' }

  const existing = await activeMembershipFor(clerkUserId, plan.member_id)
  if (existing) return { error: 'already_member' }

  const price = await ensurePrice(plan)
  const customer = await ensureCustomer(clerkUserId, email, name)
  const back = opts.returnPath || `/members/${plan.member_id}`

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer,
    line_items: [{ price, quantity: 1 }],
    subscription_data: {
      // Our cut of every renewal, not just the first — the same 5% the shop pays.
      application_fee_percent: PLATFORM_FEE * 100,
      transfer_data: { destination: connectAccountId },
      metadata: {
        kind: 'membership',
        plan_id: plan.id,
        member_id: plan.member_id,
        clerk_user_id: clerkUserId,
      },
    },
    // Repeated on the session because checkout.session.completed carries the
    // session's metadata, and the subscription's is only reachable after a fetch.
    metadata: {
      kind: 'membership',
      plan_id: plan.id,
      member_id: plan.member_id,
      clerk_user_id: clerkUserId,
    },
    success_url: `${SITE_URL}/shopper/memberships?joined=1`,
    cancel_url: `${SITE_URL}${back}?membership=canceled`,
  })
  return session.url ? { url: session.url } : { error: 'session_failed' }
}

/**
 * Stop a membership at the end of the paid period.
 *
 * Not an immediate cancel: they paid through a date, and yanking the discount
 * they already bought would be taking money for nothing. Stripe flips the row to
 * `canceled` at the period end and the webhook writes it.
 */
export async function cancelMembership(
  membershipId: string,
  clerkUserId: string
): Promise<{ ok: boolean; error?: string }> {
  const m = await getMembership(membershipId)
  if (!m || m.clerk_user_id !== clerkUserId) return { ok: false, error: 'not_found' }
  if (!m.stripe_subscription_id) return { ok: false, error: 'no_subscription' }
  await stripe.subscriptions.update(m.stripe_subscription_id, { cancel_at_period_end: true })
  await supabase
    .from('memberships')
    .update({ cancel_at_period_end: true, updated_at: new Date().toISOString() })
    .eq('id', membershipId)
  return { ok: true }
}

/** Undo a pending cancellation while the period is still running. */
export async function resumeMembership(
  membershipId: string,
  clerkUserId: string
): Promise<{ ok: boolean; error?: string }> {
  const m = await getMembership(membershipId)
  if (!m || m.clerk_user_id !== clerkUserId) return { ok: false, error: 'not_found' }
  if (!m.stripe_subscription_id) return { ok: false, error: 'no_subscription' }
  await stripe.subscriptions.update(m.stripe_subscription_id, { cancel_at_period_end: false })
  await supabase
    .from('memberships')
    .update({ cancel_at_period_end: false, updated_at: new Date().toISOString() })
    .eq('id', membershipId)
  return { ok: true }
}

/**
 * Write a Stripe Subscription into `memberships`.
 *
 * Called from the billing webhook for anything tagged `kind: membership`. Keyed
 * on the Stripe subscription id, so replays and out-of-order deliveries settle
 * on the same row instead of minting duplicates.
 */
export async function syncMembershipFromStripe(sub: Stripe.Subscription): Promise<void> {
  const meta = sub.metadata ?? {}
  if (meta.kind !== 'membership') return
  const planId = meta.plan_id as string | undefined
  const memberId = meta.member_id as string | undefined
  const clerkUserId = meta.clerk_user_id as string | undefined
  if (!planId || !memberId || !clerkUserId) return

  const item = sub.items.data[0]
  const periodEnd =
    item?.current_period_end ??
    (sub as unknown as { current_period_end?: number }).current_period_end
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id ?? null
  const canceled = sub.status === 'canceled'

  const { data: existing } = await supabase
    .from('memberships')
    .select('id, started_at')
    .eq('stripe_subscription_id', sub.id)
    .maybeSingle()

  await supabase.from('memberships').upsert(
    {
      ...(existing ? { id: (existing as { id: string }).id } : {}),
      plan_id: planId,
      member_id: memberId,
      clerk_user_id: clerkUserId,
      status: sub.status,
      cancel_at_period_end: !!sub.cancel_at_period_end,
      current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      price_cents: item?.price?.unit_amount ?? 0,
      billing_interval: item?.price?.recurring?.interval === 'year' ? 'year' : 'month',
      stripe_subscription_id: sub.id,
      stripe_customer_id: customerId,
      started_at:
        (existing as { started_at?: string } | null)?.started_at ??
        new Date((sub.start_date ?? Date.now() / 1000) * 1000).toISOString(),
      canceled_at: canceled ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'stripe_subscription_id' }
  )
}

/** Monthly recurring revenue from live members, in cents. Annual is spread over 12. */
export function monthlyRevenueCents(members: Membership[]): number {
  return members
    .filter((m) => (ENTITLED_STATUSES as unknown as string[]).includes(m.status))
    .reduce(
      (sum, m) => sum + (m.billing_interval === 'year' ? Math.round(m.price_cents / 12) : m.price_cents),
      0
    )
}

/** Attach who joined, from the Checkout session that created the subscription. */
export async function setSubscriberIdentity(
  stripeSubscriptionId: string,
  who: { email: string | null; name: string | null }
): Promise<void> {
  if (!who.email && !who.name) return
  await supabase
    .from('memberships')
    .update({
      ...(who.email ? { subscriber_email: who.email } : {}),
      ...(who.name ? { subscriber_name: who.name } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', stripeSubscriptionId)
}
