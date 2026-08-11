// Square Appointments: what can be checked WITHOUT a Square account.
//
//   npx tsx scripts/square-smoke.mts
//   npx tsx scripts/square-smoke.mts <sandbox-access-token>   ← the real test
//
// With no argument this covers the parts that are ours: credential isolation,
// the no-calendar fallback, and the booking record shape. The live API calls
// stay UNVERIFIED.
//
// Pass a Square SANDBOX token and it will actually talk to Square — list
// locations, read bookable services and search availability — which is why
// `square_env` exists as an explicit column rather than being sniffed.

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
const sq = await import('../lib/square-appointments')
const bookings = await import('../lib/bookings')

const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
})
const anon = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
  auth: { persistSession: false },
})

const MEMBER = 'square-smoke-vendor'
const SANDBOX_TOKEN = process.argv[2] ?? null
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
  console.log('\nCredential isolation')
  await sq.saveSquareCreds(MEMBER, { token: 'sq_fake_token', locationId: 'L1', env: 'sandbox' })
  const creds = await sq.getSquareCreds(MEMBER)
  check('the server can read the token', creds?.token === 'sq_fake_token')
  check('the environment round-trips', creds?.env === 'sandbox')

  const { data: leaked, error: anonErr } = await anon
    .from('vendor_secrets')
    .select('square_token')
    .eq('member_id', MEMBER)
  check(
    'the ANON key cannot read a Square token',
    !!anonErr || !leaked || leaked.length === 0,
    anonErr ? `blocked: ${anonErr.code}` : `LEAKED ${JSON.stringify(leaked)}`
  )

  console.log('\nEnvironment is explicit, never guessed')
  await sq.saveSquareCreds(MEMBER, { env: 'production' })
  check('it can be switched to production', (await sq.getSquareCreds(MEMBER))?.env === 'production')
  const { error: badEnv } = await db
    .from('vendor_secrets')
    .update({ square_env: 'staging' })
    .eq('member_id', MEMBER)
  check('an unknown environment is rejected by the database', !!badEnv)

  console.log('\nNo calendar = the request flow, never a crash')
  await sq.disconnectSquare(MEMBER)
  check('disconnect clears the token', (await sq.getSquareCreds(MEMBER)) === null)

  console.log('\nA booked slot is recorded as already agreed')
  const booked = await bookings.createBookingRequest({
    memberId: MEMBER,
    customerId: 'square-smoke-customer',
    customerEmail: 'sq@example.com',
    requestedDate: '2099-05-01',
    requestedTime: '10:00 AM',
    squareBookingId: 'sqbk_123',
    squareServiceVariationId: 'var_1',
    startsAt: '2099-05-01T17:00:00Z',
    status: 'confirmed',
  })
  check('it lands confirmed, not awaiting a reply', booked.status === 'confirmed')
  check('the Square booking id is kept for cancellation', booked.square_booking_id === 'sqbk_123')
  check('the exact instant is stored alongside the human time', !!booked.starts_at)
  check('the agreed time reads back', bookings.bookingWhen(booked) === '2099-05-01 · 10:00 AM')

  const plain = await bookings.createBookingRequest({
    memberId: MEMBER,
    customerId: 'square-smoke-customer',
    requestedDate: '2099-05-02',
  })
  check('a free-text request still starts as needing a reply', plain.status === 'requested')
  check('...and holds no exact instant, because none was agreed', plain.starts_at === null)

  // ── The live half ────────────────────────────────────────────────────────
  if (SANDBOX_TOKEN) {
    console.log('\nLIVE against Square sandbox')
    const live = { token: SANDBOX_TOKEN, locationId: null, env: 'sandbox' as const }
    const locations = await sq.listLocations(live)
    check(`locations load (${locations.length})`, locations.length > 0)

    if (locations.length > 0) {
      const withLoc = { ...live, locationId: locations[0].id }
      const services = await sq.listBookableServices(withLoc)
      check(`bookable services load (${services.length})`, Array.isArray(services))
      if (services.length > 0) {
        check('a service has a duration', services[0].durationMinutes > 0)
        const start = new Date()
        const end = new Date(start.getTime() + 7 * 864e5)
        const slots = await sq.searchAvailability(withLoc, {
          serviceVariationId: services[0].variationId,
          startAt: start.toISOString(),
          endAt: end.toISOString(),
        })
        check(`availability search returns (${slots.length} slots)`, Array.isArray(slots))
      } else {
        console.log('  · no bookable services in that sandbox account — mark one bookable to go further')
      }
    }
  } else {
    console.log('\n· Skipping the live half. Pass a Square SANDBOX token as argv[1] to exercise it.')
  }
} finally {
  console.log('\nCleaning up')
  await db.from('booking_requests').delete().eq('member_id', MEMBER)
  await db.from('vendor_secrets').delete().eq('member_id', MEMBER)
}

console.log(`\n${pass} passed, ${fail} failed`)
if (!SANDBOX_TOKEN) console.log('NOTE: the live Square calls are UNVERIFIED.\n')
process.exit(fail === 0 ? 0 : 1)
