import { NextResponse } from 'next/server'
import {
  getVendorEventsByMember,
  createVendorEvent,
  updateVendorEvent,
  deleteVendorEvent,
} from '@/lib/vendor-connect'
import { resolveActor } from '@/lib/admin'
import { gateCapability } from '@/lib/gate'
import { getMember } from '@/lib/api'
import { demoEvents } from '@/lib/demo-organize'

// GET — public list (active only). With ?include_drafts=1, requires owner/admin.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ memberId: string }> }
) {
  const { memberId } = await params
  const includeDrafts = new URL(req.url).searchParams.get('include_drafts') === '1'

  if (includeDrafts) {
    const actor = await resolveActor(memberId)
    if (!actor || actor.memberId !== memberId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    if (actor.isDemo) return NextResponse.json(demoEvents(memberId))
    return NextResponse.json(await getVendorEventsByMember(memberId, true))
  }
  return NextResponse.json(await getVendorEventsByMember(memberId, false))
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ memberId: string }> }
) {
  const { memberId } = await params
  const actor = await resolveActor(memberId)
  if (!actor || actor.memberId !== memberId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }
  // Creating/organizing events is a Pro capability.
  const gated = await gateCapability(memberId, 'organizeEvents', { bypass: actor.isAdmin })
  if (gated) return gated

  const body = await req.json().catch(() => ({}))
  const items = Array.isArray(body.events) ? body.events : [body]
  const memberName = String(body.memberName ?? 'Vendor')

  // Denormalize the host's place so events can be scoped to a neighborhood, and
  // default the map pin to the business's own coordinates (the create form can
  // drag it elsewhere).
  let hostCity: string | null = null
  let hostHood: string | null = null
  let hostLat: number | null = null
  let hostLng: number | null = null
  try {
    const m = await getMember(memberId)
    hostCity = (m.member.profile?.city as string) || null
    hostHood = (m.member.profile?.neighborhood as string) || null
    hostLat = typeof m.member.profile?.latitude === 'number' ? m.member.profile.latitude : null
    hostLng = typeof m.member.profile?.longitude === 'number' ? m.member.profile.longitude : null
  } catch {
    /* best-effort */
  }

  const created = []
  for (const e of items) {
    if (!e?.title) continue
    created.push(
      await createVendorEvent(memberId, memberName, {
        title: String(e.title),
        description: e.description ?? null,
        event_date: e.event_date ?? e.date ?? null,
        event_time: e.event_time ?? e.time ?? null,
        location: e.location ?? null,
        city: e.city ?? hostCity,
        neighborhood: e.neighborhood ?? hostHood,
        lat: typeof e.lat === 'number' ? e.lat : hostLat,
        lng: typeof e.lng === 'number' ? e.lng : hostLng,
        poster_image_url: e.poster_image_url ?? null,
        capacity: e.capacity != null && e.capacity !== '' ? Number(e.capacity) : null,
        active: e.active ?? false, // default to draft for review
        source: e.source ?? 'manual',
      })
    )
  }
  return NextResponse.json({ created })
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ memberId: string }> }
) {
  const { memberId } = await params
  const actor = await resolveActor(memberId)
  if (!actor || actor.memberId !== memberId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }
  const gated = await gateCapability(memberId, 'organizeEvents', { bypass: actor.isAdmin })
  if (gated) return gated

  const body = await req.json().catch(() => ({}))
  if (!body.id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const fields: Record<string, unknown> = {}
  for (const k of ['title', 'description', 'event_date', 'event_time', 'location', 'lat', 'lng', 'poster_image_url', 'capacity', 'active'] as const) {
    if (k in body) fields[k] = body[k]
  }
  await updateVendorEvent(String(body.id), memberId, fields)
  return NextResponse.json({ ok: true })
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ memberId: string }> }
) {
  const { memberId } = await params
  const actor = await resolveActor(memberId)
  if (!actor || actor.memberId !== memberId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }
  const { id } = await req.json().catch(() => ({ id: '' }))
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  await deleteVendorEvent(String(id), memberId)
  return NextResponse.json({ ok: true })
}
