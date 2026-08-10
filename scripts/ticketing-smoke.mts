// End-to-end smoke test of ticketing against the REAL database.
//
// Creates a throwaway event, issues tickets, admits one at the door, tries to
// admit it a second time, checks stock and capacity accounting, then deletes
// everything it made. Run deliberately:  npx tsx scripts/ticketing-smoke.ts
//
// It exists because the interesting failures here are not type errors — they're
// "the same QR scanned twice both said yes" and "the sold count didn't move".

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
const tickets = await import('../lib/tickets')

const db = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } }
)

const MEMBER = 'smoke-member-ticketing'
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

// ── Setup ────────────────────────────────────────────────────────────────────
const { data: event, error: evErr } = await db
  .from('vendor_events')
  .insert({
    member_id: MEMBER,
    member_name: 'Ticketing Smoke',
    title: 'Ticketing smoke test',
    event_date: '2099-01-01',
    capacity: 5,
    active: false, // never shows in any public feed
  })
  .select()
  .single()
if (evErr || !event) throw new Error(`Could not create test event: ${evErr?.message}`)
const eventId = event.id as string
console.log(`\nTest event ${eventId}`)

try {
  // ── Ticket types ───────────────────────────────────────────────────────────
  console.log('\nTicket types')
  const paid = await tickets.createTicketType(eventId, MEMBER, { name: 'General', price_cents: 1500, quantity: 3 })
  const free = await tickets.createTicketType(eventId, MEMBER, { name: 'Free tier', price_cents: 0 })
  const avail0 = await tickets.getAvailability(eventId)
  check('two tiers on sale', avail0.length === 2)
  check('limited tier reports its stock', avail0.find((t) => t.id === paid.id)?.remaining === 3)
  check('unlimited tier reports null stock', avail0.find((t) => t.id === free.id)?.remaining === null)

  // ── Issuing ────────────────────────────────────────────────────────────────
  console.log('\nIssuing')
  const issued = await tickets.issueTickets({
    eventId,
    memberId: MEMBER,
    lines: [{ ticketTypeId: paid.id, ticketTypeName: 'General', priceCents: 1500, quantity: 2 }],
    buyerEmail: 'smoke@example.com',
    buyerName: 'Smoke Tester',
    attendeeId: 'smoke-attendee',
    paymentIntentId: 'pi_smoke_test',
  })
  check('a party of 2 gets 2 separate tickets', issued.length === 2)
  check('every ticket has its own token', new Set(issued.map((t) => t.token)).size === 2)
  check('tokens are long enough to be unguessable', issued.every((t) => t.token.length >= 20))
  check('codes are human-readable', issued.every((t) => /^[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/.test(t.code)))

  const again = await tickets.issueTickets({
    eventId,
    memberId: MEMBER,
    lines: [{ ticketTypeId: paid.id, ticketTypeName: 'General', priceCents: 1500, quantity: 2 }],
    buyerEmail: 'smoke@example.com',
    buyerName: 'Smoke Tester',
    attendeeId: 'smoke-attendee',
    paymentIntentId: 'pi_smoke_test',
  })
  check('re-issuing the same payment mints nothing new', again.length === 2 && again[0].id === issued[0].id)

  const avail1 = await tickets.getAvailability(eventId)
  check('stock drops by what was sold', avail1.find((t) => t.id === paid.id)?.remaining === 1)
  check('issued headcount is the ticket count', (await tickets.getIssuedCount(eventId)) === 2)

  // ── The door ───────────────────────────────────────────────────────────────
  console.log('\nThe door')
  const first = await tickets.checkInTicket(issued[0].token, eventId, MEMBER, 'smoke-doorman')
  check('a valid QR is admitted', first.ok)

  const second = await tickets.checkInTicket(issued[0].token, eventId, MEMBER, 'smoke-doorman')
  check('the SAME QR is refused the second time', !second.ok && second.reason === 'already_in')

  const byUrl = await tickets.checkInTicket(tickets.ticketUrl(issued[1].token), eventId, MEMBER, 'smoke-doorman')
  check('a scanned URL (not a bare token) works', byUrl.ok)

  check('checked-in count tracks the door', (await tickets.getCheckedInCount(eventId)) === 2)

  await tickets.undoCheckIn(issued[1].id, MEMBER)
  check('undo puts someone back outside', (await tickets.getCheckedInCount(eventId)) === 1)

  const typed = await tickets.checkInTicket(issued[1].code.toLowerCase().replace('-', ''), eventId, MEMBER, 'smoke-doorman')
  check('a typed short code works (case/dash insensitive)', typed.ok)

  const nonsense = await tickets.checkInTicket('ZZZZ-ZZZZ', eventId, MEMBER, 'smoke-doorman')
  check('an unknown code is refused', !nonsense.ok && nonsense.reason === 'not_found')

  const wrongHost = await tickets.checkInTicket(issued[0].token, eventId, 'some-other-member', 'imposter')
  check("another business can't scan this event's tickets", !wrongHost.ok)

  // ── Free RSVP ↔ tickets ────────────────────────────────────────────────────
  console.log('\nFree RSVP')
  const rsvp2 = await tickets.syncRsvpTickets({ eventId, memberId: MEMBER, attendeeId: 'smoke-rsvp', partySize: 2 })
  check('an RSVP for 2 mints 2 tickets', rsvp2.length === 2)

  const rsvpAgain = await tickets.syncRsvpTickets({ eventId, memberId: MEMBER, attendeeId: 'smoke-rsvp', partySize: 2 })
  check('re-submitting the same RSVP does not double it', rsvpAgain.length === 2)

  const rsvp3 = await tickets.syncRsvpTickets({ eventId, memberId: MEMBER, attendeeId: 'smoke-rsvp', partySize: 3 })
  check('growing the party issues only the difference', rsvp3.length === 3)
  check('the original codes survive a party change', rsvp3.slice(0, 2).every((t, i) => t.token === rsvp2[i].token))

  const rsvp1 = await tickets.syncRsvpTickets({ eventId, memberId: MEMBER, attendeeId: 'smoke-rsvp', partySize: 1 })
  check('shrinking the party cancels the surplus', rsvp1.length === 1 && rsvp1[0].token === rsvp2[0].token)

  await tickets.cancelRsvpTickets(eventId, 'smoke-rsvp')
  const afterCancel = await tickets.getTicketsForAttendee('smoke-rsvp')
  check('cancelling an RSVP voids its tickets', afterCancel.filter((t) => t.event_id === eventId).length === 0)

  // ── Refunds ────────────────────────────────────────────────────────────────
  console.log('\nRefunds')
  await tickets.cancelTicketsForPaymentIntent('pi_smoke_test', 'refunded')
  const refunded = await tickets.checkInTicket(issued[0].token, eventId, MEMBER, 'smoke-doorman')
  check('a refunded ticket stops scanning', !refunded.ok && refunded.reason === 'void')
  const availAfter = await tickets.getAvailability(eventId)
  check('refunded seats go back on sale', availAfter.find((t) => t.id === paid.id)?.remaining === 3)

  // ── Deactivation ───────────────────────────────────────────────────────────
  console.log('\nTiers with sales')
  const del = await tickets.deleteTicketType(free.id, MEMBER)
  check('an unsold tier deletes outright', del.deleted === true)
} finally {
  // ── Teardown ───────────────────────────────────────────────────────────────
  await db.from('event_tickets').delete().eq('event_id', eventId)
  await db.from('event_ticket_types').delete().eq('event_id', eventId)
  await db.from('event_attendees').delete().eq('event_id', eventId)
  await db.from('vendor_events').delete().eq('id', eventId)
  console.log('\nCleaned up.')
}

console.log(`\n${pass} passed, ${fail} failed\n`)
process.exit(fail === 0 ? 0 : 1)
