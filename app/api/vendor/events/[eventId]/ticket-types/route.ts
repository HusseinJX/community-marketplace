import { NextResponse } from 'next/server'
import { resolveActor } from '@/lib/admin'
import { getVendorEventById, getVendorConnectAccount } from '@/lib/vendor-connect'
import { getAvailability, createTicketType, updateTicketType, deleteTicketType } from '@/lib/tickets'

// Ticket tiers for one event. Host only (admins may act on behalf, via
// resolveActor's existing rule).

async function host(eventId: string) {
  const event = await getVendorEventById(eventId)
  if (!event) return { error: NextResponse.json({ error: 'Event not found' }, { status: 404 }) }
  const actor = await resolveActor(event.member_id)
  if (!actor || actor.memberId !== event.member_id) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 403 }) }
  }
  return { event, actor }
}

export async function GET(_req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params
  const h = await host(eventId)
  if ('error' in h) return h.error

  const [types, connect] = await Promise.all([
    getAvailability(eventId),
    getVendorConnectAccount(h.event.member_id),
  ])
  // The organizer needs to know BEFORE they price a tier that money can't land
  // anywhere yet — otherwise they publish a $20 ticket nobody can buy.
  return NextResponse.json({
    types,
    capacity: h.event.capacity ?? null,
    payoutsReady: connect?.status === 'active',
  })
}

export async function POST(req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params
  const h = await host(eventId)
  if ('error' in h) return h.error
  if (h.actor.isDemo) return NextResponse.json({ demo: true })

  const body = await req.json().catch(() => ({}))
  if (!body.name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

  const type = await createTicketType(eventId, h.event.member_id, {
    name: String(body.name),
    description: body.description ? String(body.description) : null,
    price_cents: Number(body.priceCents) || 0,
    quantity: body.quantity == null || body.quantity === '' ? null : Number(body.quantity),
    max_per_order: Number(body.maxPerOrder) || 10,
    sales_end: body.salesEnd ? String(body.salesEnd) : null,
    sort_order: Number(body.sortOrder) || 0,
  })
  return NextResponse.json({ type })
}

export async function PATCH(req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params
  const h = await host(eventId)
  if ('error' in h) return h.error
  if (h.actor.isDemo) return NextResponse.json({ demo: true })

  const body = await req.json().catch(() => ({}))
  if (!body.id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  await updateTicketType(String(body.id), h.event.member_id, {
    ...(body.name !== undefined ? { name: String(body.name) } : {}),
    ...(body.description !== undefined ? { description: body.description ? String(body.description) : null } : {}),
    ...(body.priceCents !== undefined ? { price_cents: Number(body.priceCents) || 0 } : {}),
    ...(body.quantity !== undefined ? { quantity: body.quantity == null || body.quantity === '' ? null : Number(body.quantity) } : {}),
    ...(body.maxPerOrder !== undefined ? { max_per_order: Number(body.maxPerOrder) || 10 } : {}),
    ...(body.salesEnd !== undefined ? { sales_end: body.salesEnd ? String(body.salesEnd) : null } : {}),
    ...(body.active !== undefined ? { active: !!body.active } : {}),
  })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params
  const h = await host(eventId)
  if ('error' in h) return h.error
  if (h.actor.isDemo) return NextResponse.json({ demo: true })

  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  // Sold tiers deactivate rather than delete — see deleteTicketType.
  const result = await deleteTicketType(id, h.event.member_id)
  return NextResponse.json(result)
}
