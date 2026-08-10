// Digital delivery, end to end against the REAL storage bucket and database.
//
//   npx tsx scripts/digital-smoke.mts
//
// The question this exists to answer is not "does the code run" but "can a
// stranger get the file without paying". So it uploads a real file, delivers a
// real order, downloads the bytes back, and then tries to reach the object
// without a signature.

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
const digital = await import('../lib/digital')
const { deliverDigitalItems } = await import('../lib/digital-deliver')

const db = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } }
)

const MEMBER = 'digital-smoke-vendor'
const SECRET = `the paid content ${Date.now()}`
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

let filePath = ''
let orderId = ''

try {
  console.log('\nStoring the file')
  check('service-role is present, so URLs can be signed', digital.digitalConfigured())
  const up = await digital.uploadDigitalFile(Buffer.from(SECRET, 'utf8'), {
    memberId: MEMBER,
    filename: 'recipes.pdf',
    contentType: 'application/pdf',
  })
  filePath = up.path
  check('the file uploads', !!filePath)
  check('the stored name is randomised, not the original', !filePath.endsWith('/recipes.pdf'))

  console.log('\nThe bucket is actually private')
  // The whole paywall rests on this. A public bucket would make the object URL
  // the product: paste it anywhere and it's free forever.
  const publicUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/${digital.DIGITAL_BUCKET}/${filePath}`
  const anon = await fetch(publicUrl)
  check(`the object is NOT readable without a signature (${anon.status})`, !anon.ok)

  console.log('\nSelling it')
  const { data: product } = await db
    .from('products')
    .insert({
      member_id: MEMBER, member_name: 'Digital Smoke', name: 'Recipe ebook', price: 800, active: true,
      kind: 'digital', digital_file_path: filePath, digital_file_name: 'recipes.pdf', digital_file_size: SECRET.length,
    })
    .select()
    .single()
  check('a digital product exists', !!product)

  const { data: order } = await db
    .from('orders')
    .insert({
      order_number: `DIG-${Date.now()}`, payment_intent_id: `pi_digital_smoke_${Date.now()}`,
      member_id: MEMBER, buyer_email: 'buyer@example.com', status: 'delivered',
      items: [{ name: 'Recipe ebook', qty: 1, price_cents: 800 }],
      subtotal_cents: 800, platform_fee_cents: 40, vendor_amount_cents: 760,
      fulfillment_type: 'digital', delivery_requested: false,
    })
    .select()
    .single()
  orderId = order!.id

  const delivered = await deliverDigitalItems(order!, { buyerEmail: 'buyer@example.com' })
  check('one grant is issued for one digital line', delivered === 1)

  const again = await deliverDigitalItems(order!, { buyerEmail: 'buyer@example.com' })
  check('delivering twice does not double-grant (webhook + browser race)', again === 1)

  const grants = await digital.getGrantsByPaymentIntent(order!.payment_intent_id)
  check('the grant is findable by payment intent', grants.length === 1)
  const token = grants[0].token
  check('the token is long enough to be unguessable', token.length >= 20)

  console.log('\nThe buyer downloads it')
  const redeemed = await digital.redeemGrant(token)
  check('redeeming mints a signed URL', redeemed.ok)
  if (redeemed.ok) {
    const res = await fetch(redeemed.url)
    const body = await res.text()
    check('the signed URL returns the ACTUAL paid bytes', body === SECRET, `got ${body.slice(0, 40)}`)
    check(
      'it downloads under the original filename, not the hex one',
      (res.headers.get('content-disposition') ?? '').includes('recipes.pdf'),
      res.headers.get('content-disposition') ?? 'no header'
    )
  }

  const second = await digital.redeemGrant(token)
  check('re-downloading still works (new phone, two years later)', second.ok)
  if (second.ok) check('each redemption mints a DIFFERENT url', second.url !== (redeemed.ok ? redeemed.url : ''))

  const after = await digital.getGrantByToken(token)
  check('downloads are counted', after?.download_count === 2)

  console.log('\nRefusals')
  check('an unknown token is refused', !(await digital.redeemGrant('not-a-real-token')).ok)

  await db.from('digital_grants').update({ max_downloads: 2 }).eq('token', token)
  const exhausted = await digital.redeemGrant(token)
  check('a download cap is enforced once reached', !exhausted.ok && exhausted.reason === 'exhausted')

  await db.from('digital_grants').update({ max_downloads: null, expires_at: '2000-01-01T00:00:00Z' }).eq('token', token)
  const expired = await digital.redeemGrant(token)
  check('an expired grant is refused', !expired.ok && expired.reason === 'expired')

  console.log('\nMixed baskets — the one that silently swallows a download')
  const { data: good } = await db
    .from('products')
    .insert({ member_id: MEMBER, member_name: 'Digital Smoke', name: 'Sourdough', price: 1200, active: true, kind: 'good' })
    .select()
    .single()
  const { data: mixed } = await db
    .from('orders')
    .insert({
      order_number: `MIX-${Date.now()}`, payment_intent_id: `pi_mixed_smoke_${Date.now()}`,
      member_id: MEMBER, buyer_email: 'buyer@example.com', status: 'paid',
      items: [{ name: 'Sourdough', qty: 1, price_cents: 1200 }, { name: 'Recipe ebook', qty: 1, price_cents: 800 }],
      subtotal_cents: 2000, platform_fee_cents: 100, vendor_amount_cents: 1900,
      // Classed PHYSICAL because the bread has to change hands...
      fulfillment_type: 'pickup', delivery_requested: false,
    })
    .select()
    .single()
  const mixedDelivered = await deliverDigitalItems(mixed!, { buyerEmail: 'buyer@example.com' })
  // ...but the ebook must still arrive. Gating delivery on fulfillment_type
  // would have dropped it on the floor.
  check('a download bought alongside a physical item is still delivered', mixedDelivered === 1)
  check('the physical line does NOT get a grant', mixedDelivered === 1)

  await db.from('digital_grants').delete().eq('payment_intent_id', mixed!.payment_intent_id)
  await db.from('orders').delete().eq('id', mixed!.id)
  await db.from('products').delete().eq('id', good!.id)
} finally {
  console.log('\nCleaning up')
  await db.from('digital_grants').delete().eq('member_id', MEMBER)
  await db.from('orders').delete().eq('member_id', MEMBER)
  await db.from('products').delete().eq('member_id', MEMBER)
  if (filePath) await digital.deleteDigitalFile(filePath)
  void orderId
}

console.log(`\n${pass} passed, ${fail} failed\n`)
process.exit(fail === 0 ? 0 : 1)
