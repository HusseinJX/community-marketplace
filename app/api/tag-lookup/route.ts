import { NextResponse } from 'next/server'
import { getMember, listEvents } from '@/lib/api'
import { getVendorEventById } from '@/lib/vendor-connect'
import { getBroadcastById } from '@/lib/broadcasts'
import { eventLabel } from '@/lib/live-events'

export const runtime = 'nodejs'

// Resolve the display name of a scanned QR entity so the share composer can show
// the real business/event name in the tag chip (the client's cached directory
// only holds the first ~100, so a scanned id is usually not in it). Public,
// read-only, name-only — no sensitive fields leave the server.
export async function GET(req: Request) {
  const url = new URL(req.url)
  const kind = url.searchParams.get('kind')
  const id = url.searchParams.get('id')
  if (!id || (kind !== 'business' && kind !== 'event')) {
    return NextResponse.json({ error: 'kind (business|event) + id required' }, { status: 400 })
  }

  if (kind === 'business') {
    try {
      const m = await getMember(id)
      const name =
        (m.member.profile?.businessName as string) ||
        (m.member.profile?.name as string) ||
        null
      return NextResponse.json({ name })
    } catch {
      return NextResponse.json({ name: null })
    }
  }

  // kind === 'event' — the QR may be a vendor_events id, a connector event, or a
  // live broadcast (/live/<id>). Try each until one names it.
  try {
    const ve = await getVendorEventById(id)
    if (ve?.title) return NextResponse.json({ name: ve.title })
  } catch {
    /* try next */
  }
  try {
    const b = await getBroadcastById(id)
    if (b) {
      return NextResponse.json({
        name: b.whats_on || eventLabel(b.event_slug) || b.member_name || null,
      })
    }
  } catch {
    /* try next */
  }
  try {
    const { events } = await listEvents({ limit: 200 })
    const ev = events.find((e) => e.id === id)
    if (ev?.title) return NextResponse.json({ name: ev.title })
  } catch {
    /* give up */
  }
  return NextResponse.json({ name: null })
}
