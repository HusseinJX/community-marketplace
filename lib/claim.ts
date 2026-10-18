import 'server-only'
import { currentUser } from '@clerk/nextjs/server'
import { invalidateMembers, invalidateMember } from '@/lib/cache'
import { setVendorProfile } from '@/lib/vendor-connect'
import { patchMember } from '@/lib/api'
import type { PlaceDetails } from '@/lib/places'
import type { MemberProfile } from '@/lib/types'

/**
 * Everything that happens once ownership is PROVEN: flip the page to claimed,
 * link it to the account, and stamp who the owner is.
 *
 * Shared by /api/claim (verify-then-claim, one request) and /api/join/commit
 * (verified earlier, before sign-in). Two copies of this is how one of them
 * ends up linking the account and the other not.
 *
 * The connector's claim-profile refuses unless `profile.ownershipVerification`
 * is set — the caller is responsible for that having happened.
 */
export async function finishClaim(opts: {
  memberId: string
  userId: string
  method: string
  evidence?: Record<string, unknown>
  ownerName?: string
  ownerRole?: string
}): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const { memberId, userId } = opts
  const apiBase = process.env.NEXT_PUBLIC_API_BASE || 'https://community-connector-agent.netlify.app'
  const adminToken = process.env.CONNECTOR_ADMIN_TOKEN
  if (!adminToken) return { ok: false, status: 500, error: 'CONNECTOR_ADMIN_TOKEN not configured' }

  const claimRes = await fetch(`${apiBase}/.netlify/functions/claim-profile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ unclaimedId: memberId, claimedBy: userId }),
  })
  if (!claimRes.ok) {
    const err = await claimRes.text()
    return { ok: false, status: claimRes.status, error: err || 'Claim failed' }
  }

  // Link the Clerk user to the member.
  //
  // Without this the claim proved ownership on the connector but left no local
  // record, so resolveActor found nothing and the vendor was sent to
  // /vendor/setup to search for and re-verify the business they'd just claimed.
  try {
    const clerkUser = await currentUser()
    const email = clerkUser?.emailAddresses?.[0]?.emailAddress ?? null
    await setVendorProfile(userId, memberId, email, 'verified', opts.method, opts.evidence)
  } catch (err) {
    // The claim itself succeeded — don't fail the request. /vendor/setup is
    // still there as a manual path if this write didn't land.
    console.error('claim: vendor_profiles link failed:', err)
  }

  // Stamp who claimed it. A CLAIMED page never had a creation moment of its
  // own, so without this the owner of a business we canvassed is nobody — no
  // name to greet, no role to know whether we are talking to the owner or the
  // Tuesday closer.
  const owner: Record<string, string> = {}
  if (typeof opts.ownerName === 'string' && opts.ownerName.trim()) owner.ownerName = opts.ownerName.trim()
  if (typeof opts.ownerRole === 'string' && opts.ownerRole.trim()) owner.ownerRole = opts.ownerRole.trim()
  if (Object.keys(owner).length > 0) {
    try {
      await patchMember(memberId, owner)
    } catch (err) {
      console.error('claim: owner stamp failed:', err)
    }
  }

  // Claiming flips status (and indexability) — refresh the directory snapshot,
  // and this member's own page, which now shows an owner.
  invalidateMembers()
  invalidateMember(memberId)
  return { ok: true }
}

// Google tags nearly everything with these; they say nothing about a business.
const GENERIC = ['point_of_interest', 'establishment', 'food', 'store']

/**
 * A new member's profile, built on the SERVER from a Google listing.
 *
 * This used to be assembled in the browser and posted to /api/members/create,
 * which took it as given — so the phone the ownership code went to was
 * whatever the client said it was. Now the client sends a placeId and nothing
 * else about the business.
 */
export function profileFromPlace(
  d: PlaceDetails,
  memberType: string,
): Partial<MemberProfile> & { name: string } {
  return {
    name: d.name,
    memberType,
    category: d.types.find((t) => !GENERIC.includes(t))?.replace(/_/g, ' ') || undefined,
    city: d.city || undefined,
    neighborhood: d.neighborhood || undefined,
    // The only reliable source of coordinates — without them the business
    // never lands on the /live map.
    latitude: d.lat ?? undefined,
    longitude: d.lng ?? undefined,
    phone: d.phone || undefined,
    // What resolveOwnershipPhone reads for any later ownership check.
    businessPhone: d.phone || undefined,
    googleMapsUrl: `https://www.google.com/maps/place/?q=place_id:${d.placeId}`,
    businessDescription: d.summary || undefined,
    websiteUrl: d.website || undefined,
  } as Partial<MemberProfile> & { name: string }
}
