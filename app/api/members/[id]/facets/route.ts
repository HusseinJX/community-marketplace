import { NextResponse } from 'next/server'
import { resolveActor } from '@/lib/admin'
import { patchMember } from '@/lib/api'
import { BUSINESS_SIZES, OWNERSHIP_TAGS } from '@/lib/business-facets'

const SIZES = new Set(BUSINESS_SIZES.map((s) => s.key) as string[])
const OWNERSHIP = new Set(OWNERSHIP_TAGS.map((o) => o.key) as string[])

// PATCH — set a member's business facets (size + ownership tags). Owner or admin
// only. Body: { businessSize?, ownershipTags? }
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const actor = await resolveActor(id)
  if (!actor || actor.memberId !== id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const fields: { businessSize?: string; ownershipTags?: string[] } = {}
  if ('businessSize' in body) {
    fields.businessSize = SIZES.has(body.businessSize) ? body.businessSize : undefined
  }
  if (Array.isArray(body.ownershipTags)) {
    fields.ownershipTags = body.ownershipTags.filter((t: unknown): t is string => typeof t === 'string' && OWNERSHIP.has(t))
  }
  if (Object.keys(fields).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  try {
    await patchMember(id, fields)
    return NextResponse.json({ ok: true, fields })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update facets'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
