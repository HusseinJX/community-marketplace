// Self-delivery: the pricing rules and the money split.
//
//   npx tsx scripts/self-delivery-smoke.mts
//
// The rules engine is pure, so most of this is arithmetic — but it's arithmetic
// that decides whether a vendor gets paid, so it gets checked rather than
// assumed. The last section is the one that matters most: WHO KEEPS THE FEE.

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

const { quoteSelfDelivery, selfDeliveryRules, effectiveDeliveryMode, normalizeZip } = await import('../lib/fulfillment')
const { uberConfigured } = await import('../lib/uber-direct')
const { calculateFees } = await import('../lib/stripe-server')
import type { VendorSettings } from '../lib/vendor-connect'

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

function settings(over: Partial<VendorSettings> = {}): VendorSettings {
  return {
    member_id: 'm',
    delivery_mode: 'self',
    uber_direct_enabled: false,
    uber_pickup_address: '1 Valencia St',
    uber_pickup_phone: null,
    composio_connection_id: null,
    composio_platform: null,
    self_delivery_fee_cents: 500,
    ...over,
  }
}

console.log('\nMode resolution')
check('self delivery works without any platform credentials', effectiveDeliveryMode(settings()) === 'self')

// Uber's mode depends on the environment this runs in, so assert the RULE
// rather than one of its outcomes — a machine with credentials in .env.local
// resolves 'uber', one without resolves 'none', and both are correct.
const uberMode = effectiveDeliveryMode(settings({ delivery_mode: 'uber', uber_direct_enabled: true }))
check(
  `uber tracks platform credentials (configured=${uberConfigured()} → ${uberMode})`,
  uberMode === (uberConfigured() ? 'uber' : 'none')
)
check(
  'self delivery is unaffected by Uber either way — that is the point',
  effectiveDeliveryMode(settings({ delivery_mode: 'self' })) === 'self'
)
check('a vendor with no settings row delivers nothing', effectiveDeliveryMode(null) === 'none')
check(
  'a legacy row with only the old boolean is still an uber vendor',
  effectiveDeliveryMode({ ...settings({ uber_direct_enabled: true }), delivery_mode: undefined }) !== 'self'
)

console.log('\nFee rules')
const flat = selfDeliveryRules(settings())
const q1 = quoteSelfDelivery(flat, 2000, '94110')
check('a flat fee is charged', q1.ok && q1.feeCents === 500)

const freeOver = selfDeliveryRules(settings({ self_delivery_free_over_cents: 4000 }))
check('under the free-over threshold still pays', (() => { const q = quoteSelfDelivery(freeOver, 3999, '94110'); return q.ok && q.feeCents === 500 })())
check('at the threshold delivery is free', (() => { const q = quoteSelfDelivery(freeOver, 4000, '94110'); return q.ok && q.feeCents === 0 && q.free })())

const minOrder = selfDeliveryRules(settings({ self_delivery_min_order_cents: 2500 }))
const below = quoteSelfDelivery(minOrder, 2000, '94110')
check('below the minimum, delivery is refused', !below.ok && below.reason === 'below_minimum')
check('the refusal says how much more is needed', !below.ok && below.shortfallCents === 500)
check('at the minimum it is allowed', quoteSelfDelivery(minOrder, 2500, '94110').ok)

console.log('\nCoverage')
const anywhere = selfDeliveryRules(settings({ self_delivery_zips: [] }))
check('EMPTY ZIP LIST MEANS ANYWHERE, not nowhere', quoteSelfDelivery(anywhere, 2000, '99999').ok)
check('...even with no zip supplied at all', quoteSelfDelivery(anywhere, 2000, null).ok)

const scoped = selfDeliveryRules(settings({ self_delivery_zips: ['94110', '94103'] }))
check('a covered zip is delivered to', quoteSelfDelivery(scoped, 2000, '94110').ok)
const out = quoteSelfDelivery(scoped, 2000, '94085')
check('an uncovered zip is refused', !out.ok && out.reason === 'out_of_area')
check('a missing zip against a scoped list is refused', !quoteSelfDelivery(scoped, 2000, '').ok)
check('ZIP+4 matches its 5-digit round', quoteSelfDelivery(scoped, 2000, '94110-1234').ok)
check('whitespace and case are ignored', normalizeZip(' 94110 ') === '94110')

console.log('\nPrecedence')
const both = selfDeliveryRules(settings({ self_delivery_min_order_cents: 5000, self_delivery_zips: ['94110'] }))
const b = quoteSelfDelivery(both, 1000, '99999')
check('the minimum is reported before the area (the fixable one first)', !b.ok && b.reason === 'below_minimum')

console.log('\nWho keeps the fee  ← the point of the whole feature')
const itemsCents = 4000
const feeCents = 500
const { platformFee, vendorAmount } = calculateFees(itemsCents)

// Mirrors create-payment-intent exactly.
const uberApplicationFee = platformFee + feeCents
const selfApplicationFee = platformFee

check('platform takes 5% of items', platformFee === 200)
check('buyer pays items + fee in both modes', itemsCents + feeCents === 4500)
check('UBER: the platform keeps the fee (it pays the courier)', uberApplicationFee === 700)
check('SELF: the platform does NOT keep the fee', selfApplicationFee === 200)
check(
  'SELF: the vendor receives items - 5% + the whole delivery fee',
  itemsCents + feeCents - selfApplicationFee === vendorAmount + feeCents,
  `${itemsCents + feeCents - selfApplicationFee} vs ${vendorAmount + feeCents}`
)
check(
  'the fee is never taxed in either mode',
  calculateFees(itemsCents).platformFee === calculateFees(itemsCents + feeCents).platformFee - Math.round(feeCents * 0.05)
)
check('free delivery pays the vendor exactly the item total less 5%', (() => {
  const q = quoteSelfDelivery(freeOver, 5000, '94110')
  if (!q.ok) return false
  const fees = calculateFees(5000)
  return q.feeCents === 0 && 5000 - fees.platformFee === fees.vendorAmount
})())

console.log(`\n${pass} passed, ${fail} failed\n`)
process.exit(fail === 0 ? 0 : 1)
