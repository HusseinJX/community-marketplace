import { NextResponse } from 'next/server'
import { createMember } from '@/lib/api'
import { resolveActor } from '@/lib/admin'
import { addTags } from '@/lib/member-tags'
import { invalidateMembers } from '@/lib/cache'
import type { MemberProfile } from '@/lib/types'

export const runtime = 'nodejs'

// POST { vendors: [{ name, category?, description? }], tag?, ownerMemberId? }
// Super-admin only. Creates a member per vendor (connector), and — when a
// festival/group `tag` is given — tags every one of them so the organizer can
// pull the whole group up later (member_tags → bulk-add-to-lineup).
//
// Mirrors the single-create flow (/api/members/create) but for a whole extracted
// lineup at once. Best-effort per row: a failure on one vendor never aborts the
// rest; the response reports exactly what was created and what failed.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))

  // Creating members is an admin capability (this app can't create members
  // otherwise — see createMember). Require a real admin actor.
  const actor = await resolveActor(body.ownerMemberId ?? undefined)
  if (!actor || !actor.isAdmin) {
    return NextResponse.json({ error: 'Admins only' }, { status: 403 })
  }
  const ownerId = actor.memberId

  const rawVendors = Array.isArray(body.vendors) ? body.vendors : []
  const tagLabel = typeof body.tag === 'string' ? body.tag.trim() : ''

  const vendors = rawVendors
    .map((v: { name?: unknown; category?: unknown; description?: unknown }) => ({
      name: String(v?.name ?? '').trim(),
      category: v?.category ? String(v.category).trim() : undefined,
      description: v?.description ? String(v.description).trim() : undefined,
    }))
    .filter((v: { name: string }) => v.name)

  if (vendors.length === 0) {
    return NextResponse.json({ error: 'No vendors to create' }, { status: 400 })
  }

  const created: { name: string; memberId: string; claimUrl: string }[] = []
  const failed: { name: string; error: string }[] = []

  for (const v of vendors) {
    try {
      const profile: Partial<MemberProfile> & { name: string } = {
        name: v.name,
        memberType: 'vendor',
        ...(v.category ? { category: v.category } : {}),
        ...(v.description ? { businessDescription: v.description } : {}),
      }
      const member = await createMember(profile, { source: 'lineup_import' })
      created.push({ name: v.name, memberId: member.id, claimUrl: `/claim/${member.id}` })

      // Festival/group tag → so the whole lineup can be pulled up + bulk-invited.
      if (tagLabel) {
        try {
          await addTags(ownerId, member.id, v.name, [tagLabel])
        } catch {
          // Member exists regardless; tagging is best-effort.
        }
      }
    } catch (err) {
      failed.push({ name: v.name, error: err instanceof Error ? err.message : 'Failed to create' })
    }
  }

  if (created.length > 0) invalidateMembers()

  return NextResponse.json({ created, failed, tag: tagLabel || null })
}
