import { NextResponse } from 'next/server'
import { resolveActor } from '@/lib/admin'
import { patchMember } from '@/lib/api'
import type { MemberProfile } from '@/lib/types'
import { invalidateMembers } from '@/lib/cache'

/** A profile is a gallery, not an album. */
const MAX_IMAGES = 12

// PATCH — edit a member's public "about" fields (bio + basic details). Owner or
// admin only.
//
// Body: { bio?, category?, city?, neighborhood?, address?, hours?, instagram?,
//         website?, images?, ownerName?, ownerRole? }
//
// `images` is the member's PHOTO GALLERY, in display order — the first one is
// the cover, so `imageUrl` is written from it in the same call. Sending `[]`
// removes them all, which is a thing a vendor is allowed to do; that is why the
// key is only read when it is present.
//
// `instagram` and `website` are ALSO reachable through the links route, which
// is the surface that owns every platform handle. They stay here because this
// endpoint predates it and other callers still send them; both write the same
// profile fields, so the two can't disagree.
//
// Only keys PRESENT in the body are touched — an absent key is left alone,
// which is what lets a partial form save without blanking what it doesn't show.
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
  if ('address' in body) fields.businessAddress = str(body.address) || ''
  if ('hours' in body) fields.businessHours = str(body.hours) || ''
  if ('instagram' in body) fields.instagramHandle = (str(body.instagram) || '').replace(/^@/, '')
  if ('website' in body) fields.websiteUrl = str(body.website) || ''
  // Who we are dealing with at this business. Normally stamped by /api/claim
  // when someone proves ownership; also written here so an ADMIN setting a page
  // up on behalf can record the owner's name and role WITHOUT /api/claim
  // linking the business to the admin's own account. Same resolveActor gate as
  // every other field on this route.
  if ('ownerName' in body) fields.ownerName = str(body.ownerName) || ''
  if ('ownerRole' in body) fields.ownerRole = str(body.ownerRole) || ''
  if ('images' in body) {
    // Server-side truth about the list: strings, https, deduped, capped. The
    // client uploads through /api/upload and sends back what it got, so this is
    // not the only line of defence — but it is the one that runs for every
    // caller, including one that never touched the uploader.
    const raw: unknown[] = Array.isArray(body.images) ? body.images : []
    const images: string[] = Array.from(
      new Set(
        raw
          .map((u) => str(u))
          .filter((u): u is string => !!u && u.startsWith('https://'))
      )
    ).slice(0, MAX_IMAGES)
    fields.images = images
    // The cover follows the order. Every surface that shows ONE photo reads
    // imageUrl, so leaving it behind would mean a card still showing a picture
    // the vendor deleted.
    fields.imageUrl = images[0] ?? ''
  }

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
