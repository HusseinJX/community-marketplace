import { NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { invalidateMembers, invalidateMember } from '@/lib/cache'
import { setVendorProfile } from '@/lib/vendor-connect'
import { patchMember } from '@/lib/api'

// POST { memberId, method, value, ownerName?, ownerRole? }
// Proxies verify + claim-profile calls to the connector agent.
// Clerk userId becomes claimedBy in the claim-profile call.
// CONNECTOR_ADMIN_TOKEN is held server-side and never exposed to clients.
//
// ⚠️ TWO METHODS, AND THE LIST IS THE POINT.
//
//   phone_otp   — a code texted to the number ON THE LISTING, read back here.
//                 The only proof an entity can give, because it is the only one
//                 that requires POSSESSION of something only the business has.
//   self_owned  — a person's own page. There is no anchor to prove; the account
//                 is the claim.
//
// The connector will also accept `google_maps`, `instagram`, `website_email`
// and `gemini`. This app must not send them, and refuses them here rather than
// merely hiding the buttons: `google_maps` "verifies" by pasting a Maps URL or
// Place ID — both public, both printed on the listing itself, both copyable by
// exactly the person you are trying to keep out. A UI that stops offering a
// back door has not closed it.
export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const {
    memberId,
    method,
    value,
    ownerName,
    ownerRole,
  }: {
    memberId: string
    method: string
    value: string
    ownerName?: string
    ownerRole?: string
  } = body

  if (!memberId || !method || !value) {
    return NextResponse.json({ error: 'memberId, method, and value are required' }, { status: 400 })
  }

  const ALLOWED = ['phone_otp', 'self_owned']
  if (!ALLOWED.includes(method)) {
    return NextResponse.json(
      { error: 'Ownership is proved by a code sent to the number on the listing.' },
      { status: 400 }
    )
  }

  const apiBase = process.env.NEXT_PUBLIC_API_BASE || 'https://community-connector-agent.netlify.app'
  const adminToken = process.env.CONNECTOR_ADMIN_TOKEN
  if (!adminToken) {
    return NextResponse.json({ error: 'CONNECTOR_ADMIN_TOKEN not configured' }, { status: 500 })
  }

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${adminToken}`,
  }

  // Step 1: verify ownership
  const verifyRes = await fetch(`${apiBase}/.netlify/functions/verify`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ memberId, method, value }),
  })

  if (!verifyRes.ok) {
    const err = await verifyRes.text()
    return NextResponse.json({ error: err || 'Verification failed' }, { status: verifyRes.status })
  }

  const verifyResult = await verifyRes.json()

  if (!verifyResult.verified) {
    return NextResponse.json({ verified: false, evidence: verifyResult.evidence }, { status: 200 })
  }

  // Step 2: claim the profile
  const claimRes = await fetch(`${apiBase}/.netlify/functions/claim-profile`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ unclaimedId: memberId, claimedBy: userId }),
  })

  if (!claimRes.ok) {
    const err = await claimRes.text()
    return NextResponse.json({ error: err || 'Claim failed' }, { status: claimRes.status })
  }

  // Step 3: link the Clerk user to the member.
  //
  // Without this the claim proved ownership on the connector but left no local
  // record, so resolveActor found nothing and the vendor was sent to
  // /vendor/setup to search for and re-verify the business they'd just claimed.
  // Same row, same shape as /api/vendor/verify writes.
  try {
    const clerkUser = await currentUser()
    const email = clerkUser?.emailAddresses?.[0]?.emailAddress ?? null
    await setVendorProfile(userId, memberId, email, 'verified', verifyResult.method, verifyResult.evidence)
  } catch (err) {
    // The claim itself succeeded — don't fail the request. /vendor/setup is
    // still there as a manual path if this write didn't land.
    console.error('claim: vendor_profiles link failed:', err)
  }

  // Step 4: stamp who claimed it.
  //
  // A page joined through the search gets this at creation time, from the same
  // screen that asks for the account. A CLAIMED page never had a creation
  // moment of its own, so without this the owner of a business we canvassed is
  // nobody — no name to greet, no role to know whether we are talking to the
  // owner or the Tuesday closer.
  const owner: Record<string, string> = {}
  if (typeof ownerName === 'string' && ownerName.trim()) owner.ownerName = ownerName.trim()
  if (typeof ownerRole === 'string' && ownerRole.trim()) owner.ownerRole = ownerRole.trim()
  if (Object.keys(owner).length > 0) {
    try {
      await patchMember(memberId, owner)
    } catch (err) {
      // The claim stands either way — this is a detail on the profile, not the
      // ownership itself.
      console.error('claim: owner stamp failed:', err)
    }
  }

  // Claiming flips status (and indexability) — refresh the directory snapshot,
  // and this member's own page, which now shows an owner.
  invalidateMembers()
  invalidateMember(memberId)
  return NextResponse.json({ verified: true, claimed: true, method: verifyResult.method })
}
