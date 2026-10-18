import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { finishClaim } from '@/lib/claim'

// POST { memberId, method, value, ownerName?, ownerRole? }
// Proxies verify + claim-profile calls to the connector agent.
// Clerk userId becomes claimedBy in the claim-profile call.
// CONNECTOR_ADMIN_TOKEN is held server-side and never exposed to clients.
//
// ⚠️ ONE METHOD HERE, AND THE LIST IS THE POINT.
//
//   self_owned  — a person's own page. There is no anchor to prove; the account
//                 is the claim.
//
// A BUSINESS proves ownership with a code texted to the number on its listing,
// and every code goes through Twilio Verify on /api/join/verify/send → check →
// /api/join/commit. This route used to accept `phone_otp` too, checked by the
// connector's own OTP store; that was a second code path, so it is gone.
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

  const ALLOWED = ['self_owned']
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

  // Steps 2-4 — claim, link the account, stamp the owner. Shared with
  // /api/join/commit, which reaches the same point by a different route.
  const done = await finishClaim({
    memberId,
    userId,
    method: verifyResult.method,
    evidence: verifyResult.evidence,
    ownerName,
    ownerRole,
  })
  if (!done.ok) return NextResponse.json({ error: done.error }, { status: done.status })

  return NextResponse.json({ verified: true, claimed: true, method: verifyResult.method })
}
