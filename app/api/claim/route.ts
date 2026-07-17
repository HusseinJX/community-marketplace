import { NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { invalidateMembers } from '@/lib/cache'
import { setVendorProfile } from '@/lib/vendor-connect'

// POST { memberId, method, value }
// Proxies verify + claim-profile calls to the connector agent.
// Clerk userId becomes claimedBy in the claim-profile call.
// CONNECTOR_ADMIN_TOKEN is held server-side and never exposed to clients.
export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { memberId, method, value }: { memberId: string; method: string; value: string } = body

  if (!memberId || !method || !value) {
    return NextResponse.json({ error: 'memberId, method, and value are required' }, { status: 400 })
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

  // Claiming flips status (and indexability) — refresh the directory snapshot.
  invalidateMembers()
  return NextResponse.json({ verified: true, claimed: true, method: verifyResult.method })
}
