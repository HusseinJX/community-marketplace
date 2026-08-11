// Smoke test for the phone agent's booking tool — runs against the REAL DB
// and deletes what it creates. Run: npx tsx --env-file=.env.local scripts/voice-booking-smoke.mts
//
// The interesting failures here are not type errors. They are: a spoken
// "Thursday" being stored as a guessed date, and the agent telling a caller
// they are booked when the business has not agreed yet.
import { POST } from '../app/api/voice/booking/route'
import { createClient } from '@supabase/supabase-js'

const S = process.env.VOICE_TOOL_SECRET!
const BIZ = '+15622573224'
const call = async (body: unknown, secret = S) => {
  const r = await POST(new Request('https://x/api/voice/booking', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-voice-tool-secret': secret },
    body: JSON.stringify(body),
  }))
  return { status: r.status, json: await r.json() as any }
}
const iso = (d: number) => new Date(Date.now() + d * 864e5).toISOString().slice(0, 10)
let pass = 0, fail = 0
const t = (n: string, ok: boolean, extra = '') => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${extra ? '  — ' + extra : ''}`) }

t('wrong secret → 401', (await call({}, 'nope')).status === 401)
t('unknown business → 400', (await call({ business_number: '+19998887777', email: 'a@b.co', requested_date: iso(2) })).status === 400)

const noContact = await call({ business_number: BIZ, requested_date: iso(2) })
t('no email AND no phone → refused', noContact.json.ok === false, String(noContact.json.result).slice(0, 55))

const badDate = await call({ business_number: BIZ, caller_phone: '+14155551212', requested_date: 'Thursday' })
t('"Thursday" rejected, not guessed', badDate.json.ok === false)

const past = await call({ business_number: BIZ, caller_phone: '+14155551212', requested_date: iso(-3) })
t('past date rejected (mis-parse)', past.json.ok === false)

const withEmail = await call({ business_number: BIZ, caller_phone: '+14155551212', email: 'VoiceTest@Example.com',
  name: 'Voice Test', requested_date: iso(3), requested_time: 'after five', service: 'consultation', note: 'phone test' })
t('booking WITH email created', withEmail.json.ok === true, withEmail.json.result?.slice(0, 60))

const phoneOnly = await call({ business_number: BIZ, caller_phone: '+14155559999', name: 'No Email',
  requested_date: iso(4), requested_time: 'morning' })
t('booking PHONE-ONLY created', phoneOnly.json.ok === true, phoneOnly.json.result?.slice(0, 60))
t('phone-only says CALL back, not email', /call this number/i.test(phoneOnly.json.result || ''))
t('email one says NOT final until confirmed', /isn.t final|confirm/i.test(withEmail.json.result || ''))

// Inspect + clean up
const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!)
const ids = [withEmail.json.booking_id, phoneOnly.json.booking_id].filter(Boolean)
const { data } = await db.from('booking_requests').select('*').in('id', ids)
for (const b of data ?? []) {
  console.log(`   row: status=${b.status} date=${b.requested_date} time=${b.requested_time ?? '-'} email=${b.customer_email ?? '-'} phone=${b.customer_phone ?? '-'} note="${(b.note||'').slice(0,45)}"`)
}
t('lands as "requested", not confirmed', (data ?? []).every((b: any) => b.status === 'requested'))
t('note marks it as phoned in', (data ?? []).every((b: any) => /by phone/i.test(b.note || '')))
if (ids.length) await db.from('booking_requests').delete().in('id', ids)
const { data: after } = await db.from('booking_requests').select('id').in('id', ids)
t('cleaned up', (after ?? []).length === 0)

console.log(`\n${pass} passed, ${fail} failed`)

// ── check_availability ──────────────────────────────────────────────────────
// Xeno has no Square account, so this exercises the path EVERY vendor takes
// today: "no live calendar" is a normal answer, never an error, and it must
// hand the agent back to the free-text request.
{
  const { POST: AV } = await import('../app/api/voice/availability/route')
  const av = async (body: unknown, secret = S) => {
    const r = await AV(new Request('https://x/api/voice/availability', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-voice-tool-secret': secret },
      body: JSON.stringify(body),
    }))
    return { status: r.status, json: await r.json() as any }
  }

  console.log('')
  t('availability: wrong secret → 401', (await av({}, 'nope')).status === 401)
  t('availability: unknown business → 400', (await av({ business_number: '+19998887777' })).status === 400)

  const none = await av({ business_number: BIZ, date: iso(2) })
  t('no Square → real_calendar:false, NOT an error', none.status === 200 && none.json.ok === true && none.json.real_calendar === false)
  t('…and points the agent at request_booking', /request_booking/.test(none.json.result || ''), none.json.result?.slice(0, 60))

  const past = await av({ business_number: BIZ, date: iso(-2) })
  t('past day refused', /already passed/i.test(past.json.result || ''))

  // A slot for a business with no Square must NOT silently become "confirmed".
  const fakeSlot = await call({
    business_number: BIZ, caller_phone: '+14155551212', email: 'slot@example.com',
    slot_start_at: new Date(Date.now() + 5 * 864e5).toISOString(), requested_date: iso(5),
  })
  t('slot on a non-Square business degrades to a REQUEST', fakeSlot.json.ok === true && fakeSlot.json.confirmed === false)
  t('…and does not tell the caller they are booked', !/it's set|confirmed on their calendar/i.test(fakeSlot.json.result || ''))

  // The server must derive the day from the slot, not from what it was told.
  const mismatch = await call({
    business_number: BIZ, caller_phone: '+14155551212', email: 'slot2@example.com',
    slot_start_at: new Date(Date.now() + 6 * 864e5).toISOString(),
    requested_date: iso(30), // deliberately wrong
  })
  const { data: rows } = await db.from('booking_requests').select('*').in('id', [fakeSlot.json.booking_id, mismatch.json.booking_id].filter(Boolean))
  const m = (rows ?? []).find((r: any) => r.id === mismatch.json.booking_id)
  // Expected day must be computed CITY-LOCAL, not from toISOString(). An
  // evening-in-SF slot is already the next day in UTC, so a UTC expectation
  // fails against correct code — the same trap this app hit when UTC "today"
  // hid every evening's events from the feed.
  const slotIso = new Date(Date.now() + 6 * 864e5).toISOString()
  const expected = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(new Date(slotIso))
  t('date derived from the SLOT, not the claimed date', m?.requested_date === expected, `stored ${m?.requested_date}, expected ${expected}, claimed ${iso(30)}`)

  const cleanup = [fakeSlot.json.booking_id, mismatch.json.booking_id].filter(Boolean)
  if (cleanup.length) await db.from('booking_requests').delete().in('id', cleanup)
  const { data: gone } = await db.from('booking_requests').select('id').in('id', cleanup)
  t('cleaned up', (gone ?? []).length === 0)
}

console.log(`\nTOTAL: ${pass} passed, ${fail} failed`)
