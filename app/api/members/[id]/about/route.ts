import { NextResponse } from 'next/server'
import { resolveActor } from '@/lib/admin'
import { patchMember } from '@/lib/api'
import type { MemberProfile } from '@/lib/types'
import { invalidateMembers } from '@/lib/cache'

// PATCH — edit a member's public "about" fields (bio + basic details). Owner or
// admin only. Body: { bio?, category?, city?, neighborhood?, instagram?, website? }
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const actor = await resolveActor(id)
  if (!actor || actor.memberId !== id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : undefined)

  const fields: Partial<MemberProfile> = {}
  if ('bio' in body) fields.businessDescription = str(body.bio) || ''
  if ('category' in body) fields.category = str(body.category) || ''
  if ('city' in body) fields.city = str(body.city) || ''
  if ('neighborhood' in body) fields.neighborhood = str(body.neighborhood) || ''
  if ('instagram' in body) fields.instagramHandle = (str(body.instagram) || '').replace(/^@/, '')
  if ('website' in body) fields.websiteUrl = str(body.website) || ''

  if (Object.keys(fields).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  try {
    await patchMember(id, fields)
    // Profile edits change what the directory shows + matches on.
    invalidateMembers()
    return NextResponse.json({ ok: true, fields })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
