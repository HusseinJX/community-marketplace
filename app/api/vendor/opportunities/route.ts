import { NextResponse } from 'next/server'
import { resolveReadActor } from '@/lib/admin'
import { rateLimit } from '@/lib/rate-limit'
import { getPublicEvents } from '@/lib/vendor-connect'
import { getInvitesFor } from '@/lib/collab-network'
import { matchObjective, getMember } from '@/lib/api'
import { demoOpportunities } from '@/lib/demo-match'

export const runtime = 'nodejs'

// "Opportunities near you" — the reason to come back BETWEEN your own events.
//
// There's no open-role table (collab_invites.to_id is NOT NULL, so an untargeted
// role can't be stored), and this stays read-only by design: an opportunity is
// simply an upcoming event someone ELSE is hosting that you're not already on.
// The matching engine decides which ones are worth showing — for each event we
// ask "who offers what this event needs?" and keep the ones where the acting
// member comes back as an answer. Joining reuses the existing public self-join
// (POST /api/events/join → a pending lineup entry the host approves).

export interface Opportunity {
  eventId: string
  title: string
  date: string
  location: string
  hostId: string
  hostName: string
  /** True when the matching engine surfaced this member for the event's needs. */
  fit: boolean
  /** Why it matched — the trust-builder, same idea as MatchCard. */
  reasons: string[]
  /** Miles from the acting member, when known. */
  distanceMi?: number
}

// Semantic ranking is a per-event connector call, and EVERY connector match call
// hydrates member docs out of Firestore (recommend.js does a getAll over the
// ranked ids; matches.js scans 500). So each probe is expensive in READS, not
// just latency — an unthrottled dashboard load could cost a thousand+ reads and
// is exactly the kind of thing that burns a daily quota with no users.
//
// Two guards: probe few, and cache the verdicts.
const PROBE_LIMIT = 3
const CACHE_TTL_MS = 15 * 60 * 1000

// member+event → did the matcher say this member fits? Module-level, so it
// survives across requests in the persistent container (same assumption as
// lib/rate-limit.ts). Bounded so it can't grow without limit.
const fitCache = new Map<string, { at: number; fit: boolean; reasons: string[] }>()
const CACHE_MAX = 500

function cacheGet(key: string) {
  const hit = fitCache.get(key)
  if (!hit) return null
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    fitCache.delete(key)
    return null
  }
  return hit
}

function cacheSet(key: string, fit: boolean, reasons: string[]) {
  if (fitCache.size >= CACHE_MAX) {
    // Cheap eviction: drop the oldest inserted key.
    const oldest = fitCache.keys().next().value
    if (oldest) fitCache.delete(oldest)
  }
  fitCache.set(key, { at: Date.now(), fit, reasons })
}

export async function GET(req: Request) {
  const requested = new URL(req.url).searchParams.get('memberId')
  // Read-only → demo visitors allowed.
  const actor = await resolveReadActor(requested)
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Each probe is an OpenAI + Pinecone + Firestore call. Cap real callers, and
  // never let the self-serve demo cookie trigger one (it still sees the events,
  // just without semantic "fit" badges).
  const limited = rateLimit({ req, name: 'opportunities', id: actor.memberId, limit: 20, windowMs: 60_000, ipLimit: 40 })
  if (limited) return limited

  // Demo: never touch the live event feed or the paid matcher — serve curated
  // opportunities so the Admin demo always shows the request-to-join flow alive.
  if (actor.isDemo) {
    return NextResponse.json({ opportunities: demoOpportunities() })
  }

  let events: Awaited<ReturnType<typeof getPublicEvents>> = []
  try {
    events = await getPublicEvents(50)
  } catch {
    return NextResponse.json({ opportunities: [] })
  }

  // Drop your own events, and any you're already invited to / on the lineup for.
  const mine = new Set<string>()
  try {
    const { incoming, outgoing } = await getInvitesFor(actor.memberId)
    for (const i of [...incoming, ...outgoing]) {
      if (i.scope_type === 'event' && i.scope_id) mine.add(i.scope_id)
    }
  } catch {
    /* invite table unavailable → just don't filter */
  }

  const candidates = events.filter((e) => e.member_id !== actor.memberId && !mine.has(e.id))

  // Fallback signal when the matcher is slow/down: same city as the member.
  let myCity = ''
  try {
    const m = await getMember(actor.memberId)
    const p = m.member.profile as { city?: string; neighborhood?: string } | undefined
    myCity = (p?.city || p?.neighborhood || '').toLowerCase()
  } catch {
    /* connector slow → no city signal */
  }

  // Demo: show the events, skip the paid semantic probes.
  const probeable = actor.isDemo ? [] : candidates.slice(0, PROBE_LIMIT)

  const probed = await Promise.all(
    probeable.map(async (e) => {
      const key = `${actor.memberId}:${e.id}`
      const cached = cacheGet(key)
      if (cached) return { e, fit: cached.fit, reasons: cached.reasons }

      const objective = [e.title, e.description].filter(Boolean).join(' — ')
      try {
        const matches = await matchObjective(objective, 12)
        const me = matches.find((c) => c.id === actor.memberId)
        const fit = !!me
        const reasons = me?.reasons?.slice(0, 2) ?? []
        cacheSet(key, fit, reasons)
        return { e, fit, reasons }
      } catch {
        // Don't cache failures — the connector being down shouldn't pin an
        // event to "no fit" for the next 15 minutes.
        return { e, fit: false, reasons: [] as string[] }
      }
    })
  )

  // Everything not probed (beyond the cap, or all of it in demo) still lists.
  const rest = candidates
    .slice(probeable.length)
    .map((e) => ({ e, fit: false, reasons: [] as string[] }))

  // Local events outrank far-away ones when nothing else separates them.
  const isNear = (e: (typeof candidates)[number]) =>
    myCity ? `${e.city ?? ''} ${e.neighborhood ?? ''} ${e.location ?? ''}`.toLowerCase().includes(myCity) : false

  const out: Opportunity[] = [...probed, ...rest]
    .sort(
      (a, b) => Number(b.fit) - Number(a.fit) || Number(isNear(b.e)) - Number(isNear(a.e))
    )
    .map(({ e, fit, reasons }) => ({
      eventId: e.id,
      title: e.title,
      date: [e.event_date, e.event_time].filter(Boolean).join(' · '),
      location: [e.location, e.city || e.neighborhood].filter(Boolean).join(' · '),
      hostId: e.member_id,
      hostName: e.member_name ?? 'Organizer',
      fit,
      reasons,
    }))

  return NextResponse.json({ opportunities: out.slice(0, 8) })
}
