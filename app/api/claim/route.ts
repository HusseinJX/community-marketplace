import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { invalidateMembers } from '@/lib/cache'

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

  // Claiming flips status (and indexability) — refresh the directory snapshot.
  invalidateMembers()
  return NextResponse.json({ verified: true, claimed: true, method: verifyResult.method })
}
