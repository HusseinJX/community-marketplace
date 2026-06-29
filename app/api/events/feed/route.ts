import { NextResponse } from 'next/server'
import { getPublicEvents } from '@/lib/vendor-connect'
import { listEvents } from '@/lib/api'

export const runtime = 'nodejs'

export interface FeedEvent {
  eventId: string
  title: string
  date: string
  location: string
  description: string
  image: string | null
  memberId: string
  memberName: string
}

// Public community-feed events: real in-app organizer/vendor events
// (vendor_events) first, then connector-sourced events, deduped by id.
export async function GET() {
  const out: FeedEvent[] = []
  const seen = new Set<string>()

  try {
    for (const e of await getPublicEvents(50)) {
      if (seen.has(e.id)) continue
      seen.add(e.id)
      out.push({
        eventId: e.id,
        title: e.title,
        date: [e.event_date, e.event_time].filter(Boolean).join(' · '),
        location: e.location ?? '',
        description: e.description ?? '',
        image: e.poster_image_url ?? null,
        memberId: e.member_id,
        memberName: e.member_name ?? 'Organizer',
      })
    }
  } catch {
    /* vendor_events unavailable — fall through to connector events */
  }

  try {
    const { events } = await listEvents({ limit: 50 })
    for (const e of events) {
      if (!e.id || seen.has(e.id)) continue
      seen.add(e.id)
      out.push({
        eventId: e.id,
        title: e.title ?? 'Event',
        date: [e.date, e.time].filter(Boolean).join(' · '),
        location: e.location ?? '',
        description: e.reworded ?? e.description ?? '',
        image: null,
        memberId: e.memberId ?? '',
        memberName: e.memberName ?? 'Organizer',
      })
    }
  } catch {
    /* connector down — return whatever we have */
  }

  return NextResponse.json({ events: out })
}
