import { NextResponse } from 'next/server'
import { getSquareCreds, listBookableServices, searchAvailability } from '@/lib/square-appointments'
import { resolveBusinessForCall } from '@/lib/business-phone'
import { CITY_TZ, sfToday } from '@/lib/sf-date'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Telnyx webhook TOOL: "what have you got on Thursday?"
//
// Everywhere else in this app a customer SUGGESTS a time, because we don't hold
// the diary. When the business runs Square Appointments we do — so the agent
// can offer times that are genuinely open instead of taking a request and
// hoping.
//
// A business without Square is not an error: `real_calendar: false` is the
// normal answer, and it puts the agent back on "what time suits you?". The
// caller never has to know which kind of business they rang.

interface Body {
  business_number?: string
  dialed_number?: string
  member_id?: string
  /** The day the caller asked about, YYYY-MM-DD. */
  date?: string
  service?: string
}

/**
 * Say a time the way a person says it.
 *
 * Square returns RFC3339 instants; "2026-08-14T21:15:00Z" is unspeakable, and
 * an agent reading UTC would offer 9pm for a 2pm slot. Formatted in the CITY's
 * timezone, not the server's or the caller's — the appointment happens where
 * the business is.
 */
function spokenTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: CITY_TZ,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

// Only what a person can hold in their head. The assistant's instructions
// already forbid reading out more than three things, and a phone call is the
// one place a wall of options is actively hostile.
const MAX_SPOKEN = 3

export async function POST(req: Request) {
  const secret = process.env.VOICE_TOOL_SECRET
  if (secret && req.headers.get('x-voice-tool-secret') !== secret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const body = (await req.json().catch(() => ({}))) as Body

  const { memberId: routed } = resolveBusinessForCall({
    dialed: body.business_number || body.dialed_number,
  })
  const memberId = routed || body.member_id
  if (!memberId) {
    return NextResponse.json({ ok: false, error: 'unknown_business' }, { status: 400 })
  }

  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(body.date ?? '')) ? String(body.date) : null
  if (date && date < sfToday()) {
    return NextResponse.json({
      ok: true,
      real_calendar: true,
      slots: [],
      result: "That day has already passed — ask which upcoming day they'd like.",
    })
  }

  // EVERY failure here degrades to the free-text request rather than erroring.
  // A Square outage, wrong scopes or an expired token must never take the
  // booking conversation down — asking for a preferred time is what every other
  // business on the platform offers anyway.
  try {
    const creds = await getSquareCreds(memberId)
    if (!creds?.locationId) {
      return NextResponse.json({
        ok: true,
        real_calendar: false,
        slots: [],
        result:
          "This business doesn't have a live calendar. Ask what day and roughly what time suits them, then use request_booking.",
      })
    }

    const services = await listBookableServices(creds)
    if (services.length === 0) {
      return NextResponse.json({
        ok: true,
        real_calendar: false,
        slots: [],
        result:
          'No bookable services are set up. Ask what day and time suits them, then use request_booking.',
      })
    }

    // Match loosely on what the caller said ("a cut", "colour"); Square
    // schedules a service VARIATION, not a service, so the variation id is what
    // both the search and the booking need.
    const wanted = body.service?.trim().toLowerCase()
    const service =
      (wanted && services.find((s) => s.name?.toLowerCase().includes(wanted))) || services[0]

    // A named day is that whole local day; with no day, look a week ahead so
    // "when are you next free?" gets a real answer.
    const start = date ? new Date(`${date}T00:00:00Z`) : new Date()
    const end = new Date(start.getTime() + (date ? 1 : 7) * 24 * 60 * 60 * 1000)

    const slots = await searchAvailability(creds, {
      serviceVariationId: service.variationId,
      startAt: start.toISOString(),
      endAt: end.toISOString(),
    })

    if (slots.length === 0) {
      return NextResponse.json({
        ok: true,
        real_calendar: true,
        service: service.name,
        slots: [],
        result: date
          ? `Nothing is open on ${date} for ${service.name}. Offer to check another day.`
          : `Nothing is open in the next week for ${service.name}. Offer to take a message.`,
      })
    }

    const offered = slots.slice(0, MAX_SPOKEN).map((s) => ({
      // What the agent SAYS.
      time: spokenTime(s.startAt),
      // What it must pass back to request_booking to take this exact slot.
      // Opaque to the agent on purpose — it echoes it, it doesn't compose it.
      slot_start_at: s.startAt,
      team_member_id: s.teamMemberId,
    }))

    return NextResponse.json({
      ok: true,
      real_calendar: true,
      service: service.name,
      service_variation_id: service.variationId,
      total_open: slots.length,
      slots: offered,
      result: `Open for ${service.name}: ${offered.map((o) => o.time).join(', ')}. Offer these, and when they pick one, call request_booking with that slot_start_at exactly as given.`,
    })
  } catch (err) {
    console.error('voice/availability failed:', err)
    // Deliberately ok:true — the call carries on as a plain request.
    return NextResponse.json({
      ok: true,
      real_calendar: false,
      slots: [],
      result:
        "Couldn't reach the calendar. Ask what day and time suits them and use request_booking instead.",
    })
  }
}
