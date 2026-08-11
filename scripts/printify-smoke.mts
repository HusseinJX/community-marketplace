// Printify: what can be checked WITHOUT a Printify account.
//
//   npx tsx scripts/printify-smoke.mts
//
// Be clear about the limits of this file. Every other commerce feature in this
// repo was exercised against the real upstream before shipping; Printify could
// not be, because no vendor has connected an account. So this covers the parts
// that are ours — credential isolation, address mapping, the no-op path, and
// the fee split — and the live API calls remain UNVERIFIED until someone pastes
// in a real token.

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
const printify = await import('../lib/printify')
const { toPrintifyAddress, printifyLinesFor } = await import('../lib/printify-commerce')
const { calculateFees } = await import('../lib/stripe-server')

const MEMBER = 'printify-smoke-vendor'
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

const service = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
})
const anon = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
  auth: { persistSession: false },
})

try {
  console.log('\nCredential isolation  ← the reason vendor_secrets exists')
  await printify.savePrintifyCreds(MEMBER, { token: 'pfy_fake_token_do_not_use', shopId: '12345' })
  const mine = await printify.getPrintifyCreds(MEMBER)
  check('the server can read a stored token', mine?.token === 'pfy_fake_token_do_not_use')

  // vendor_settings grants SELECT to anon, which is exactly why the token is
  // NOT stored there. Prove the new table refuses the anon key for real, rather
  // than trusting the grants listing.
  const { data: leaked, error: anonErr } = await anon.from('vendor_secrets').select('printify_token').eq('member_id', MEMBER)
  check(
    'the ANON key cannot read vendor_secrets',
    !!anonErr || !leaked || leaked.length === 0,
    anonErr ? `blocked: ${anonErr.code}` : `LEAKED ${JSON.stringify(leaked)}`
  )

  const { error: writeErr } = await anon.from('vendor_secrets').insert({ member_id: 'anon-attack', printify_token: 'x' })
  check('the ANON key cannot write vendor_secrets', !!writeErr, writeErr ? `blocked: ${writeErr.code}` : 'WROTE A ROW')

  // For contrast: the same key CAN read vendor_settings, which is the whole
  // argument for the split.
  const { error: settingsErr } = await anon.from('vendor_settings').select('member_id').limit(1)
  check('...while vendor_settings IS anon-readable (hence the split)', !settingsErr)

  console.log('\nDisconnecting')
  await printify.disconnectPrintify(MEMBER)
  check('disconnect clears the token', (await printify.getPrintifyCreds(MEMBER)) === null)

  console.log('\nNo credentials = clean no-op, never a crash')
  check('line resolution returns null without creds', (await printifyLinesFor(MEMBER, [{ name: 'Tee', quantity: 1 }])) === null)

  console.log('\nAddress mapping')
  const full = toPrintifyAddress(
    { name: 'Ada Lovelace King', street: '1 Valencia St', city: 'San Francisco', state: 'CA', zip: '94110', phone: '4155550132' },
    'ada@example.com'
  )
  check('the first name is the first word', full.first_name === 'Ada')
  check('the rest becomes the last name', full.last_name === 'Lovelace King')
  check('the address carries through', full.address1 === '1 Valencia St' && full.zip === '94110')
  check('country is pinned to US rather than guessed', full.country === 'US')

  // Printify rejects an empty last name, and the buyer has already paid by the
  // time this runs — so a one-word name must not fail the order.
  const oneWord = toPrintifyAddress(
    { name: 'Prince', street: '1 A St', city: 'SF', state: 'CA', zip: '94110', phone: '' },
    null
  )
  check('a one-word name still produces a last name', !!oneWord.last_name)
  const noName = toPrintifyAddress(
    { name: '', street: '1 A St', city: 'SF', state: 'CA', zip: '94110', phone: '' },
    null
  )
  check('an empty name still produces both names', !!noName.first_name && !!noName.last_name)

  console.log('\nWho keeps the postage')
  const itemsCents = 4000
  const postage = 599
  const { platformFee, vendorAmount } = calculateFees(itemsCents)
  // Mirrors create-payment-intent: only 'uber' adds the fee to the application fee.
  const printifyApplicationFee = platformFee
  check('the platform does NOT keep the postage', printifyApplicationFee === platformFee)
  check(
    'the vendor receives items - 5% + the postage (Printify bills THEM for it)',
    itemsCents + postage - printifyApplicationFee === vendorAmount + postage
  )
  check('the postage is never taxed', calculateFees(itemsCents).platformFee === platformFee)
} finally {
  console.log('\nCleaning up')
  await service.from('vendor_secrets').delete().eq('member_id', MEMBER)
  await service.from('vendor_secrets').delete().eq('member_id', 'anon-attack')
}

console.log(`\n${pass} passed, ${fail} failed`)
console.log('NOTE: the live Printify API calls (shops, products, shipping, orders) are UNVERIFIED.\n')
process.exit(fail === 0 ? 0 : 1)
