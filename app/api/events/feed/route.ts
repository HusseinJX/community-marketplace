import { NextResponse } from 'next/server'
import { getPublicEvents, getMemberEvents } from '@/lib/vendor-connect'
import { getAcceptedLineupCounts } from '@/lib/collab-network'
import { listEvents } from '@/lib/api'

export const runtime = 'nodejs'

// Cache the whole response for 60s. GET takes no request data, so the segment is
// cacheable (a handler that reads searchParams/headers never would be).
//
// Why it matters: this route calls the connector's listEvents, which is a
// Firestore read PER REQUEST. SWR dedupes on the client, but that's per browser
// — 100 visitors were 100 connector round-trips for data that changes a few
// times a day. Now they share one.
export const revalidate = 60

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
  /** The host + accepted lineup, for the avatar stack on event cards. */
  collaboratorList: { id: string; name: string | null }[]
  /** Watched calendar this was harvested from, else null for community events. */
  sourceId: string | null
  /** Canonical page on the source site — where a scraped card links instead of
      a member profile, because its "host" is a calendar, not a business. */
  eventUrl: string | null
}

// Public community-feed events: real in-app organizer/vendor events
// (vendor_events) first, then connector-sourced events, deduped by id.
export async function GET() {
  const out: FeedEvent[] = []
  const seen = new Set<string>()

  try {
    // Two queries, deliberately. The community's own events are fetched
    // separately and merged FIRST so that harvested calendars — which arrive
    // hundreds at a time — can never crowd a real organizer out of the feed
    // just by having a nearer date. Scraped events fill the remaining room.
    const members = await getMemberEvents(30)
    const all = await getPublicEvents(120)
    const scraped = all.filter((e) => e.source_id !== null)

    for (const e of [...members, ...scraped]) {
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
        collaboratorList: [{ id: e.member_id, name: e.member_name ?? 'Organizer' }],
        sourceId: e.source_id,
        eventUrl: e.event_url,
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
      if (!c) continue
      if (c.count > e.collaborators) e.collaborators = c.count
      // Host first, then the accepted lineup.
      e.collaboratorList = [...e.collaboratorList, ...c.members]
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
        collaboratorList: e.memberId ? [{ id: e.memberId, name: e.memberName ?? 'Organizer' }] : [],
        sourceId: null,
        eventUrl: null,
      })
    }
  } catch {
    /* connector down — return whatever we have */
  }

  return NextResponse.json({ events: out })
}
