import { NextResponse } from 'next/server'
import { resolveActor } from '@/lib/admin'
import { patchMember, getMember } from '@/lib/api'
import { getVendorSettings, upsertVendorSettings } from '@/lib/vendor-connect'
import {
  ALL_PLATFORMS,
  profileFields,
  platformById,
  asUrl,
  type LinkKind,
  type StoredLink,
  type CustomLink,
} from '@/lib/links'
import { invalidateMembers, invalidateMember } from '@/lib/cache'

// The member's links, saved in one call — from the /join links step, and from
// anywhere later that edits the same set.
//
// Body: { links?: [{id,value}], custom?: [{title,url}] }
//
// ONE list in, three places out — routed by the catalogue, never by the caller
// (see lib/links.ts):
//
//   has a profileField  → the connector member profile, the fields the public
//                         page already renders. Website, Instagram, Shopify,
//                         Etsy, the business phone.
//   kind "support"      → vendor_settings.support_links. External money links
//                         that route around Stripe Connect; their own column
//                         is what keeps them structurally apart from anything
//                         purchasable (App Store 3.1.1).
//   everything else     → vendor_settings.other_links. Toast, DoorDash, their
//                         own app, an email address.
//
// The VALIDATORS ARE THE CATALOGUE'S, run again here. The client shows the
// message inline as you type, but a client check is a courtesy, not a
// guarantee — these values become links on a public page.
//
// Owner or admin only, via resolveActor — the same gate every vendor write uses.

const MAX_CUSTOM = 12
const MAX_LEN = 300

const clean = (v: unknown) => (typeof v === 'string' ? v.trim().slice(0, MAX_LEN) : '')

interface Sorted {
  profile: StoredLink[]
  support: StoredLink[]
  other: StoredLink[]
  rejected: { id: string; reason: string }[]
}

/** Split one submitted list into where each entry actually belongs. */
function sort(raw: unknown): Sorted {
  const out: Sorted = { profile: [], support: [], other: [], rejected: [] }
  if (!Array.isArray(raw)) return out
  const seen = new Set<string>()
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const id = clean((item as StoredLink).id)
    const value = clean((item as StoredLink).value)
    if (!id || !value || seen.has(id)) continue
    // An id not in the catalogue is a typo or a caller inventing platforms.
    // Either way we could not render it, so it does not get stored.
    const p = platformById(id)
    if (!p) continue
    const bad = p.validate?.(value)
    if (bad) {
      out.rejected.push({ id, reason: bad })
      continue
    }
    seen.add(id)
    if (p.profileField) out.profile.push({ id, value })
    else if ((p.kind as LinkKind) === 'support') out.support.push({ id, value })
    else out.other.push({ id, value })
  }
  return out
}

function normaliseCustom(raw: unknown): CustomLink[] {
  if (!Array.isArray(raw)) return []
  const out: CustomLink[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const title = clean((item as CustomLink).title)
    const url = asUrl(clean((item as CustomLink).url))
    if (!title || !url) continue
    // Only http(s). A `javascript:` or `data:` URL here would be rendered as a
    // link on a public profile — this is the one place that can't be lax.
    if (!/^https?:\/\//i.test(url)) continue
    out.push({ title, url })
    if (out.length >= MAX_CUSTOM) break
  }
  return out
}


// GET — the member's links, reassembled from the three places they live, in one
// shape the editor can render. Owner or admin only: `other_links` and
// `support_links` are not secret, but they are not part of the public profile
// payload either, and this is the edit surface's own read.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const actor = await resolveActor(id)
  if (!actor || actor.memberId !== id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  try {
    const [member, settings] = await Promise.all([
      getMember(id).catch(() => null),
      getVendorSettings(id),
    ])
    const profile = (member?.member?.profile ?? {}) as Record<string, unknown>

    // Anything with a profileField is read back off the profile, so a value
    // set anywhere else (the interview, an admin edit, the Google listing at
    // signup) shows up here as an existing link rather than an empty row.
    const fromProfile: StoredLink[] = ALL_PLATFORMS.filter((p) => p.profileField)
      .map((p) => ({ id: p.id, value: String(profile[p.profileField as string] ?? '') }))
      .filter((l) => l.value.trim())

    return NextResponse.json({
      links: [...fromProfile, ...(settings?.other_links ?? []), ...(settings?.support_links ?? [])],
      custom: settings?.custom_links ?? [],
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load links'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const actor = await resolveActor(id)
  if (!actor || actor.memberId !== id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const sorted = sort(body.links)
  const custom = normaliseCustom(body.custom)

  // A value that can't be rendered is worth saying out loud rather than
  // dropping quietly — the client already blocks these, so reaching here means
  // something is out of step and a silent partial save would hide it.
  if (sorted.rejected.length > 0) {
    return NextResponse.json(
      { error: sorted.rejected.map((r) => `${r.id}: ${r.reason}`).join('; '), rejected: sorted.rejected },
      { status: 400 },
    )
  }

  try {
    // Profile fields first: they are the half the public page already renders,
    // so if the second write fails the member still got the visible part.
    const fields = profileFields(sorted.profile)
    if (Object.keys(fields).length > 0) {
      await patchMember(id, fields)
      invalidateMembers()
      invalidateMember(id)
    }

    // Written whole, replacing what was there — the client always sends the
    // complete list, so a removed link has to actually disappear. Skipped when
    // the key wasn't sent at all, so a caller updating only custom links can't
    // blank someone's support links by omission.
    if ('links' in body || 'custom' in body) {
      const existing = await getVendorSettings(id)
      await upsertVendorSettings(id, {
        support_links: 'links' in body ? sorted.support : (existing?.support_links ?? []),
        other_links: 'links' in body ? sorted.other : (existing?.other_links ?? []),
        custom_links: 'custom' in body ? custom : (existing?.custom_links ?? []),
      })
    }

    return NextResponse.json({
      ok: true,
      profile: sorted.profile.length,
      support: sorted.support.length,
      other: sorted.other.length,
      custom: custom.length,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to save links'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
