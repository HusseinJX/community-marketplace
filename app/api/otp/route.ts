import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

// POST { memberId }
// Requests an outbound ownership OTP: proxies to the connector's otp-request,
// which texts a one-time code to the profile's authoritative phone. The owner
// then confirms the code via /api/claim with method "phone_otp".
// CONNECTOR_ADMIN_TOKEN stays server-side.
export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { memberId } = await request.json()
  if (!memberId) {
    return NextResponse.json({ error: 'memberId is required' }, { status: 400 })
  }

  const apiBase = process.env.NEXT_PUBLIC_API_BASE || 'https://community-connector-agent.netlify.app'
  const adminToken = process.env.CONNECTOR_ADMIN_TOKEN
  if (!adminToken) {
    return NextResponse.json({ error: 'CONNECTOR_ADMIN_TOKEN not configured' }, { status: 500 })
  }

  const res = await fetch(`${apiBase}/.netlify/functions/otp-request`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ memberId }),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const reason = data?.reason
    const message =
      reason === 'no_phone'
        ? "This listing has no phone on file to send a code to. Try Google Maps verification instead."
        : data?.error || 'Could not send a verification code.'
    return NextResponse.json({ sent: false, reason, error: message }, { status: res.status })
  }

  return NextResponse.json({ sent: true, phoneHint: data.phoneHint })
}
