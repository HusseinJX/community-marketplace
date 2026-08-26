// Vendor memberships, against the REAL database.
//
//   npx tsx scripts/memberships-smoke.mts
//
// Stripe is NOT called: every network path here (price, customer, checkout,
// cancel) needs a live key and a real card, and none of it can be undone. What
// this proves is the half that is ours — that a tier is owned by exactly one
// business, that a discount is derived from a live membership and nothing else,
// that a retired tier keeps charging the people already on it, and above all
// that a membership can NEVER be mistaken for a platform plan. That last one is
// the whole reason this file exists: getting it wrong cancels a paying vendor.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

try {
  const raw = readFileSync(fileURLToPath(new URL('../.env.local', import.meta.url)), 'utf8')
  for (const line of raw.split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq === -1) continue
    const key = t.slice(0, eq).trim()
    let v = t.slice(eq + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    if (!(key in process.env) || process.env[key] === '') process.env[key] = v
  }
} catch {
  console.warn('Could not load .env.local')
}

const { createClient } = await import('@supabase/supabase-js')
const m = await import('../lib/memberships')

const db = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } }
)

const VENDOR = 'membership-smoke-vendor'
const OTHER = 'membership-smoke-imposter'
const SHOPPER = 'user_membership_smoke_shopper'
const STRANGER = 'user_membership_smoke_stranger'

let pass = 0
let fail = 0
function check(label: string, ok: boolean, detail = '') {
  if (ok) {
    pass++
    console.log(`  ✓ ${label}`)
  } else {
    fail++
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

try {
  console.log('\nOffering a tier')
  const plan = await m.createPlan(VENDOR, {
    name: 'Coffee Club',
    description: 'For the regulars.',
    price_cents: 1200,
    billing_interval: 'month',
    discount_percent: 10,
    perks: ['A free pastry each month', '  ', 'Members-only Sunday hours'],
  })
  check('the tier is stored', !!plan.id)
  check('it is on sale immediately', plan.active === true)
  check('blank perk lines are dropped', plan.perks.length === 2)

  console.log('\nA tier belongs to one business')
  const stolen = await m.updatePlan(plan.id, OTHER, { price_cents: 1 })
  check('another business cannot re-price it', stolen === null)
  check('the price is unchanged', (await m.getPlan(plan.id))?.price_cents === 1200)
  const stolenRetire = await m.retirePlan(plan.id, OTHER)
  check('another business cannot retire it', (await m.getPlan(plan.id))?.active === true)
  check('and is told so, rather than getting a false success', stolenRetire === false)

  console.log('\nNobody is a member until there is a membership')
  check('a stranger gets no discount', (await m.memberDiscountPercent(STRANGER, VENDOR)) === 0)
  check('a signed-out buyer gets no discount', (await m.memberDiscountPercent(null, VENDOR)) === 0)

  // Stand in for what the Stripe webhook writes, so the read paths can be
  // exercised without a card.
  const { data: joined } = await db
    .from('memberships')
    .insert({
      plan_id: plan.id,
      member_id: VENDOR,
      clerk_user_id: SHOPPER,
      status: 'active',
      price_cents: 1200,
      billing_interval: 'month',
      stripe_subscription_id: `sub_smoke_${Date.now()}`,
      started_at: new Date().toISOString(),
    })
    .select()
    .single()
  check('the membership is stored', !!joined?.id)

  console.log('\nThe discount is derived, never asserted')
  check('the member gets 10%', (await m.memberDiscountPercent(SHOPPER, VENDOR)) === 10)
  check('only at THAT business', (await m.memberDiscountPercent(SHOPPER, OTHER)) === 0)
  check('$50 basket → $5 off', m.applyDiscount(5000, 10) === 500)
  check('a discount can never exceed the basket', m.applyDiscount(5000, 200) === 5000)
  check('no membership means no arithmetic', m.applyDiscount(5000, 0) === 0)

  console.log('\nA lapsed card still gets served')
  await db.from('memberships').update({ status: 'past_due' }).eq('id', joined!.id)
  check('past_due keeps the perks while Stripe retries', (await m.memberDiscountPercent(SHOPPER, VENDOR)) === 10)
  await db.from('memberships').update({ status: 'canceled' }).eq('id', joined!.id)
  check('a cancelled membership does not', (await m.memberDiscountPercent(SHOPPER, VENDOR)) === 0)
  await db.from('memberships').update({ status: 'active' }).eq('id', joined!.id)

  console.log('\nRetiring a tier does not cancel anybody')
  await m.retirePlan(plan.id, VENDOR)
  check('it leaves the join screen', (await m.getActivePlansByMember(VENDOR)).length === 0)
  check('the vendor still sees it', (await m.getPlansByMember(VENDOR)).length === 1)
  check('the member is still a member', (await m.memberDiscountPercent(SHOPPER, VENDOR)) === 10)

  console.log('\nRevenue is summed from what people actually pay')
  const members = await m.getMembersForVendor(VENDOR)
  check('one live member at $12', m.monthlyRevenueCents(members) === 1200)
  await db.from('memberships').update({ billing_interval: 'year', price_cents: 12000 }).eq('id', joined!.id)
  check(
    'a yearly membership counts as a twelfth',
    m.monthlyRevenueCents(await m.getMembersForVendor(VENDOR)) === 1000
  )
  await db.from('memberships').update({ billing_interval: 'month', price_cents: 1200 }).eq('id', joined!.id)

  console.log('\nOne live membership per person per business')
  const { error: dup } = await db.from('memberships').insert({
    plan_id: plan.id,
    member_id: VENDOR,
    clerk_user_id: SHOPPER,
    status: 'active',
    stripe_subscription_id: `sub_smoke_dup_${Date.now()}`,
  })
  check('a second active row is refused', dup?.code === '23505', dup ? dup.message : 'insert succeeded')

  console.log('\nTHE FENCE — a membership must never touch a platform plan')
  const subs = await import('../lib/subscriptions')
  const fake = {
    id: 'sub_smoke_membership',
    status: 'active',
    customer: 'cus_smoke',
    metadata: { kind: 'membership', member_id: VENDOR },
    items: { data: [{ price: { id: 'price_smoke_vendor_tier' }, current_period_end: 0 }] },
  } as unknown as Parameters<typeof subs.syncFromStripeSubscription>[0]
  await subs.syncFromStripeSubscription(fake)
  const { data: leaked } = await db.from('subscriptions').select('*').eq('member_id', VENDOR).maybeSingle()
  check('the platform handler ignored it', !leaked, 'a membership wrote a row into `subscriptions`')

  // And the same again with the metadata stripped, because the price guard has
  // to hold on its own — a subscription created before the tag existed, or one
  // whose metadata is lost, must still be refused rather than read as `free`.
  const untagged = {
    id: 'sub_smoke_untagged',
    status: 'active',
    customer: 'cus_smoke',
    metadata: { member_id: VENDOR },
    items: { data: [{ price: { id: 'price_smoke_unknown' }, current_period_end: 0 }] },
  } as unknown as Parameters<typeof subs.syncFromStripeSubscription>[0]
  await subs.syncFromStripeSubscription(untagged)
  const { data: leaked2 } = await db.from('subscriptions').select('*').eq('member_id', VENDOR).maybeSingle()
  check('an unknown price is refused, not read as a downgrade', !leaked2)
} catch (e) {
  // Without this the `finally` below exits 0 and the failure vanishes.
  fail++
  console.error('\n  ✗ threw:', e instanceof Error ? e.message : e)
} finally {
  console.log('\nCleaning up')
  await db.from('memberships').delete().eq('member_id', VENDOR)
  await db.from('membership_plans').delete().eq('member_id', VENDOR)
  await db.from('subscriptions').delete().eq('member_id', VENDOR)
  console.log(`\n${pass} passed, ${fail} failed\n`)
  process.exit(fail ? 1 : 0)
}
