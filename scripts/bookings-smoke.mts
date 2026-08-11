// Request-to-book, against the REAL database.
//
//   npx tsx scripts/bookings-smoke.mts
//
// The thing being replaced made zero API calls and stored nothing, so the bar
// here is simply: does a request survive, can only the right business answer
// it, and does the answer say what was actually agreed.

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
const b = await import('../lib/bookings')

const db = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } }
)

const MEMBER = 'booking-smoke-vendor'
const OTHER = 'booking-smoke-imposter'
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
  console.log('\nAsking')
  const guestId = b.guestCustomerId('Guest@Example.COM ')
  check('a guest gets a stable id from their email', guestId === b.guestCustomerId('guest@example.com'))
  check('it is not the raw email', !guestId.includes('@'))

  const req = await b.createBookingRequest({
    memberId: MEMBER,
    serviceName: 'Tarot reading',
    customerId: guestId,
    customerName: 'Ada',
    customerEmail: 'guest@example.com',
    requestedDate: '2099-03-14',
    requestedTime: 'afternoon',
    altDate: '2099-03-15',
    note: 'First time, a bit nervous',
  })
  check('the request is stored', !!req.id)
  check('it starts as needing a reply', req.status === 'requested')
  check('free-text time survives', req.requested_time === 'afternoon')

  console.log('\nOnly the right business can answer')
  const stolen = await b.setBookingStatus(req.id, OTHER, 'confirmed')
  check('another business cannot confirm it', stolen === null)
  check('it is still open afterwards', (await b.getBooking(req.id))?.status === 'requested')

  console.log('\nAnswering')
  // The commonest real reply is not yes or no, it's "not then, but Friday".
  const moved = await b.setBookingStatus(req.id, MEMBER, 'confirmed', {
    confirmedDate: '2099-03-15',
    confirmedTime: '2pm',
    vendorNote: "Thursday's full, Friday works",
  })
  check('the business can confirm a DIFFERENT time', moved?.status === 'confirmed')
  check('the agreed time is recorded', moved?.confirmed_date === '2099-03-15' && moved?.confirmed_time === '2pm')
  check('what was originally asked is NOT overwritten', moved?.requested_date === '2099-03-14')
  check('the agreed time is what reads back', b.bookingWhen(moved!) === '2099-03-15 · 2pm')

  console.log('\nOrdering — an unanswered request must never be buried')
  await b.createBookingRequest({
    memberId: MEMBER,
    customerId: 'later-customer',
    customerEmail: 'later@example.com',
    requestedDate: '2099-01-01',
  })
  const list = await b.getBookingsForMember(MEMBER)
  check('the open request sorts above the confirmed one', list[0].status === 'requested')
  check('both belong to this business', list.every((r) => r.member_id === MEMBER))

  console.log('\nThe customer side')
  const mine = await b.getBookingsForCustomer(guestId)
  check('a guest can find their own booking by their derived id', mine.some((r) => r.id === req.id))
  check("...and not anyone else's", mine.every((r) => r.customer_id === guestId))

  const wrongUser = await b.cancelBooking(req.id, 'someone-else')
  check('another customer cannot cancel it', wrongUser === false)
  const cancelled = await b.cancelBooking(req.id, guestId)
  check('the customer can cancel their own', cancelled === true)
  check('a cancelled booking cannot be cancelled again', (await b.cancelBooking(req.id, guestId)) === false)

  console.log('\nFallbacks')
  const bare = await b.createBookingRequest({ memberId: MEMBER, customerId: 'x', requestedDate: null })
  check('a request with no time still reads sensibly', b.bookingWhen(bare) === 'Time to be agreed')
} finally {
  console.log('\nCleaning up')
  await db.from('booking_requests').delete().in('member_id', [MEMBER, OTHER])
}

console.log(`\n${pass} passed, ${fail} failed\n`)
process.exit(fail === 0 ? 0 : 1)
