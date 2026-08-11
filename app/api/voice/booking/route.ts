import { NextResponse } from 'next/server'
import { createBookingRequest, guestCustomerId } from '@/lib/bookings'
import { resolveBusinessForCall, normalizePhone } from '@/lib/business-phone'
import { notifyMemberUserSafe } from '@/lib/notify'
import { sfToday } from '@/lib/sf-date'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Telnyx webhook TOOL: take a BOOKING on the phone.
//
// The first real action the agent performs — "I've put you down for Thursday
// afternoon" instead of "I'll pass on your message", which is all a voicemail
// ever managed.
//
// It writes the SAME `booking_requests` rows as the web form, so a phoned-in
// booking lands in the vendor's existing /vendor/bookings inbox next to the
// rest. No second booking model, no separate screen to check.
//
// Deliberately NO payment: request-to-book takes none by design, which is
// exactly why it's the right first action for a phone agent — the agent must
// never take a card (PCI, and it isn't a payment terminal).

interface Body {
  business_number?: string
  dialed_number?: string
  member_id?: string
  caller_phone?: string
  name?: string
  email?: string
  requested_date?: string
  requested_time?: string
  service?: string
  note?: string
}

/**
 * Accept only a real ISO date, and never invent one.
 *
 * The model hears "Thursday" and has to resolve it, which it can only do
 * because /api/voice/context hands it today's date in the city's timezone. If
 * it returns anything else we store NULL rather than a guess — the vendor
 * reading "sometime next week" in the note can ask; a wrong date silently sends
 * them to the shop on the wrong day.
 */
function isoDate(raw: string | undefined): string | null {
  const s = String(raw ?? '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  const d = new Date(`${s}T12:00:00Z`)
  if (Number.isNaN(d.getTime())) return null
  // A booking in the past is a mis-parse ("Monday" resolved backwards), not a
  // real request. Compared city-local, like every other date in this app.
  if (s < sfToday()) return null
  return s
}

export async function POST(req: Request) {
  const secret = process.env.VOICE_TOOL_SECRET
  if (secret && req.headers.get('x-voice-tool-secret') !== secret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const body = (await req.json().catch(() => ({}))) as Body

  // business_number first — the only identifier that survives call forwarding.
  const { memberId: routed } = resolveBusinessForCall({
    dialed: body.business_number || body.dialed_number,
  })
  const memberId = routed || body.member_id
  if (!memberId) {
    return NextResponse.json({ ok: false, error: 'unknown_business' }, { status: 400 })
  }

  const phone = normalizePhone(body.caller_phone)
  const email = String(body.email ?? '').trim().toLowerCase()
  const hasEmail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)

  // A contact channel of SOME kind is non-negotiable — a booking the business
  // agrees to but can't confirm back is worse than no booking, because only one
  // party thinks it's happening.
  if (!hasEmail && !phone) {
    return NextResponse.json({
      ok: false,
      result:
        "Ask for an email address, or confirm the number they're calling from, before booking. Without one the business can't confirm the time back to them.",
    })
  }

  const date = isoDate(body.requested_date)
  if (!date) {
    return NextResponse.json({
      ok: false,
      result:
        "That date wasn't clear. Ask which day they'd like and pass it as a calendar date (YYYY-MM-DD), working it out from today's date.",
    })
  }

  try {
    // Guest ids hash the email; with no email the caller's number is the only
    // stable handle we have, so it identifies them instead. Same shape either
    // way, so their bookings still group together across calls.
    const customerId = hasEmail ? guestCustomerId(email) : guestCustomerId(`phone:${phone}`)

    const booking = await createBookingRequest({
      memberId,
      customerId,
      customerName: body.name?.trim() || null,
      customerEmail: hasEmail ? email : null,
      customerPhone: phone,
      requestedDate: date,
      // Time is free text on purpose ("after five", "morning") — a strict
      // picker makes people lie to the form, and doubly so out loud.
      requestedTime: body.requested_time?.trim() || null,
      serviceName: body.service?.trim() || null,
      note: [body.note?.trim(), '(booked by phone with the AI assistant)']
        .filter(Boolean)
        .join(' '),
    })

    void notifyMemberUserSafe(memberId, {
      title: 'New booking request (by phone)',
      body: `${body.name?.trim() || phone || 'A caller'} asked for ${date}${
        body.requested_time ? ` ${body.requested_time.trim()}` : ''
      }`,
      url: '/vendor/bookings',
    })

    // Say plainly that it is a REQUEST. The business still has to agree, and an
    // agent that says "you're booked" turns an unanswered request into someone
    // turning up to a closed door.
    return NextResponse.json({
      ok: true,
      booking_id: booking.id,
      result: hasEmail
        ? `Request sent for ${date}. Tell them the business will confirm by email, and that it isn't final until they do.`
        : `Request sent for ${date}. They gave no email, so tell them the business will call this number back to confirm.`,
    })
  } catch (err) {
    console.error('voice/booking failed:', err)
    // Be honest to the model so it doesn't promise a booking that never landed.
    return NextResponse.json({ ok: false, error: 'save_failed' }, { status: 500 })
  }
}
