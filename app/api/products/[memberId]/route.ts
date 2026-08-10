import { NextResponse } from 'next/server'
import {
  getProductsByMember,
  getAllProductsByMember,
  createProduct,
  updateProduct,
  deleteProduct,
} from '@/lib/vendor-connect'
import { resolveActor } from '@/lib/admin'
import { gateCapability } from '@/lib/gate'
import { kindOf } from '@/lib/product-kind'

// GET — public list (active only). With ?include_drafts=1, requires the owner
// (or an admin) and returns drafts too for the approval queue.
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
    return NextResponse.json(await getAllProductsByMember(memberId))
  }

  return NextResponse.json(await getProductsByMember(memberId))
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
  // Commerce (shop/menu/catalog) is a Pro capability.
  const gated = await gateCapability(memberId, 'commerce', { bypass: actor.isAdmin })
  if (gated) return gated

  const body = await req.json().catch(() => ({}))
  const items = Array.isArray(body.products) ? body.products : [body]
  const memberName = String(body.memberName ?? 'Vendor')

  const created = []
  for (const p of items) {
    if (!p?.name || typeof p.price !== 'number') continue
    created.push(
      await createProduct(memberId, memberName, {
        name: String(p.name),
        description: p.description ?? null,
        price: Math.max(0, Math.round(p.price)),
        currency: p.currency ?? 'usd',
        image_url: p.image_url ?? null,
        active: p.active ?? false, // default to draft for review
        source: p.source ?? 'manual',
        // Unrecognised values fall back to a physical good — see kindOf. That's
        // what every AI-scanned menu item and POS import is, and it's the only
        // reading that can't skip a handover the buyer expects.
        kind: kindOf(p.kind),
        digital_file_path: p.digital_file_path ?? null,
        digital_file_name: p.digital_file_name ?? null,
        digital_file_size: p.digital_file_size ?? null,
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
  const gated = await gateCapability(memberId, 'commerce', { bypass: actor.isAdmin })
  if (gated) return gated

  const body = await req.json().catch(() => ({}))
  if (!body.id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const fields: Record<string, unknown> = {}
  for (const k of ['name', 'description', 'price', 'currency', 'image_url', 'active', 'source', 'kind', 'digital_file_path', 'digital_file_name', 'digital_file_size'] as const) {
    if (k in body) fields[k] = k === 'price' ? Math.max(0, Math.round(body[k])) : body[k]
  }
  await updateProduct(String(body.id), memberId, fields)
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
  await deleteProduct(String(id), memberId)
  return NextResponse.json({ ok: true })
}
