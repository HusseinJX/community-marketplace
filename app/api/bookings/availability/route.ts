import { NextResponse } from 'next/server'
import { getSquareCreds, listBookableServices, searchAvailability, SquareError } from '@/lib/square-appointments'
import { rateLimit } from '@/lib/rate-limit'

// Public: does this business have a real calendar, and what's open?
//
// The booking form calls this before it renders. A business with Square
// Appointments gets real slots; everyone else gets the free-text request, and
// the customer never has to know which is which.
//
// Rate-limited because each call is a live Square request on the vendor's
// token, and this endpoint is reachable by anyone looking at a profile.
export async function POST(request: Request) {
  const limited = rateLimit({ req: request, name: 'booking-availability', id: null, limit: 30, windowMs: 60_000, ipLimit: 30 })
  if (limited) return limited

  try {
    const { memberId, serviceVariationId, date }: { memberId: string; serviceVariationId?: string; date?: string } =
      await request.json()
    if (!memberId) return NextResponse.json({ error: 'memberId is required' }, { status: 400 })

    const creds = await getSquareCreds(memberId)
    // Not an error — most businesses have no Square Appointments, and "no real
    // calendar" is the normal answer that puts the form back on free text.
    if (!creds?.locationId) return NextResponse.json({ realCalendar: false, services: [], slots: [] })

    const services = await listBookableServices(creds)
    if (services.length === 0) return NextResponse.json({ realCalendar: false, services: [], slots: [] })

    const service = serviceVariationId
      ? services.find((s) => s.variationId === serviceVariationId) ?? services[0]
      : services[0]

    // Default to the coming week. Square wants RFC3339 instants; the day the
    // customer picked is interpreted as a whole local day.
    const start = date ? new Date(`${date}T00:00:00Z`) : new Date()
    const end = new Date(start.getTime() + (date ? 1 : 7) * 24 * 60 * 60 * 1000)

    const slots = await searchAvailability(creds, {
      serviceVariationId: service.variationId,
      startAt: start.toISOString(),
      endAt: end.toISOString(),
    })

    return NextResponse.json({
      realCalendar: true,
      // Only what a browser needs — never the token, the location or the
      // team-member ids, which are the vendor's internal wiring.
      services: services.map((s) => ({
        id: s.variationId,
        name: s.name,
        durationMinutes: s.durationMinutes,
        priceCents: s.priceCents,
      })),
      serviceId: service.variationId,
      slots: slots.slice(0, 60).map((s) => s.startAt),
    })
  } catch (e) {
    // A Square outage must not take the Book button down with it — fall back to
    // the free-text request, which works for every business anyway.
    console.error('availability lookup failed:', e instanceof SquareError ? e.message : e)
    return NextResponse.json({ realCalendar: false, services: [], slots: [] })
  }
}
