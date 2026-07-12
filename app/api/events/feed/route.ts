import { NextResponse } from 'next/server'
import { getPublicEvents } from '@/lib/vendor-connect'
import { getAcceptedLineupCounts } from '@/lib/collab-network'
import { listEvents } from '@/lib/api'

export const runtime = 'nodejs'

export interface FeedEvent {
  eventId: string
  title: string
  date: string
  /** Raw event date (YYYY-MM-DD or parseable string) for now/upcoming sorting. */
  eventDate: string
  location: string
  city: string
  neighborhood: string
  description: string
  image: string | null
  memberId: string
  memberName: string
  /** How many local businesses teamed up on this event (host + accepted lineup).
      >1 means it's a real collaboration — surfaced on the card. */
  collaborators: number
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
        eventDate: e.event_date ?? '',
        location: e.location ?? '',
        city: e.city ?? '',
        neighborhood: e.neighborhood ?? '',
        description: e.description ?? '',
        image: e.poster_image_url ?? null,
        memberId: e.member_id,
        memberName: e.member_name ?? 'Organizer',
        collaborators: 1,
      })
    }
  } catch {
    /* vendor_events unavailable — fall through to connector events */
  }

  // Batched: how many businesses teamed up per (in-app) event. Best-effort —
  // if the lineup table is unavailable, cards just don't show the collab badge.
  try {
    const counts = await getAcceptedLineupCounts(out.map((e) => e.eventId))
    for (const e of out) {
      const c = counts[e.eventId]
      if (c && c.count > e.collaborators) e.collaborators = c.count
    }
  } catch {
    /* no lineup data → leave collaborators at 1 */
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
        eventDate: e.date ?? '',
        location: e.location ?? '',
        city: '',
        neighborhood: '',
        description: e.reworded ?? e.description ?? '',
        image: null,
        memberId: e.memberId ?? '',
        memberName: e.memberName ?? 'Organizer',
        collaborators: 1,
      })
    }
  } catch {
    /* connector down — return whatever we have */
  }

  return NextResponse.json({ events: out })
}
