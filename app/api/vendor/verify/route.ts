import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { setVendorProfile } from '@/lib/vendor-connect'

type VerificationMethod = 'phone' | 'website_email' | 'instagram' | 'gemini'

// Verification engine lives in the connector-agent — single source of truth.
// This route is a thin proxy that adds Clerk auth + persists the result
// into Supabase (vendor_profiles). The connector-agent /verify endpoint
// already handles Gemini fallback on structured-check failure.
export async function POST(request: Request) {
  const { userId, sessionClaims } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { memberId, method, value }: { memberId: string; method: VerificationMethod; value: string } = body

  if (!memberId || !method || !value) {
    return NextResponse.json({ error: 'memberId, method, and value are required' }, { status: 400 })
  }

  const apiBase = process.env.NEXT_PUBLIC_API_BASE || 'https://community-connector-agent.netlify.app'
  const adminToken = process.env.CONNECTOR_ADMIN_TOKEN
  if (!adminToken) {
    return NextResponse.json({ error: 'CONNECTOR_ADMIN_TOKEN not configured' }, { status: 500 })
  }

  const res = await fetch(`${apiBase}/.netlify/functions/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ memberId, method, value }),
  })

  if (!res.ok) {
    const err = await res.text()
    return NextResponse.json({ error: err || 'Verification service failed' }, { status: res.status })
  }

  const result = await res.json()

  if (result.verified) {
    const email = (sessionClaims?.email as string) ?? null
    await setVendorProfile(userId, memberId, email, 'verified', result.method, result.evidence)
    return NextResponse.json({ verified: true, method: result.method })
  }

  return NextResponse.json({ verified: false, evidence: result.evidence })
}
