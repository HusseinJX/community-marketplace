import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createMember } from '@/lib/api'
import { resolveActor } from '@/lib/admin'
import { getVendorEventById } from '@/lib/vendor-connect'
import { createInvite, setEventInviteStatus } from '@/lib/collab-network'
import { addTags } from '@/lib/member-tags'
import { isDemoMode } from '@/lib/demo-admin'
import type { MemberProfile } from '@/lib/types'
import { invalidateMembers } from '@/lib/cache'

export const runtime = 'nodejs'

// POST { profile, eventId?, mode } — create a member in the connector, then
// optionally add it to an event lineup.
//   mode 'organizer' → host is onboarding them; auto-accepted onto the lineup.
//   mode 'self'      → QR self-onboarding; lands pending for organizer approval.
export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId && !isDemoMode()) {
    return NextResponse.json({ error: 'Sign in to finish' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const profile = (body.profile ?? {}) as Partial<MemberProfile> & { name?: string }
  const name = String(profile.name ?? '').trim()
  if (!name) return NextResponse.json({ error: 'A business name is required' }, { status: 400 })

  const eventId = body.eventId ? String(body.eventId) : null
  const mode = body.mode === 'organizer' ? 'organizer' : 'self'
  const tags: string[] = Array.isArray(body.tags) ? body.tags.map(String) : []

  // Who owns the tags — the organizer doing the onboarding.
  const owner = await resolveActor(body.ownerMemberId ?? undefined)
  const ownerId = owner?.memberId ?? (isDemoMode() ? 'demo' : userId ?? 'demo')

  // Organizer-created members require the caller to actually be the event host.
  let event = null
  if (eventId) {
    event = await getVendorEventById(eventId)
    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    if (mode === 'organizer') {
      const actor = await resolveActor(event.member_id)
      if (!actor || actor.memberId !== event.member_id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
      }
    }
  }

  let member
  try {
    member = await createMember({ ...profile, name }, { source: mode === 'self' ? 'qr_onboard' : 'interview' })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create business'
    return NextResponse.json({ error: message }, { status: 502 })
  }

  // Tag onto the event lineup.
  if (event) {
    try {
      if (mode === 'organizer') {
        const inv = await createInvite({
          from_id: event.member_id,
          from_name: event.member_name,
          to_id: member.id,
          to_name: name,
          message: `Onboarded to ${event.title}`,
          scope_type: 'event',
          scope_id: event.id,
          role: 'vendor',
        })
        await setEventInviteStatus(inv.id, event.id, 'accepted')
      } else {
        await createInvite({
          from_id: member.id, // self-join
          from_name: name,
          to_id: member.id,
          to_name: name,
          message: 'Onboarded via the event link',
          scope_type: 'event',
          scope_id: event.id,
          role: 'vendor',
        })
      }
    } catch {
      // Member was created; lineup tag is best-effort.
    }
  }

  // Apply grouping tags (e.g. "farmers market") so the organizer can pull up and
  // bulk-act on everyone they onboarded.
  if (tags.length > 0) {
    try {
      await addTags(ownerId, member.id, name, tags)
    } catch {
      // Best-effort; member exists regardless.
    }
  }

  // New business → make it searchable immediately (busts the 24h directory snapshot).
  invalidateMembers()
  return NextResponse.json({ memberId: member.id, claimUrl: `/claim/${member.id}` })
}
