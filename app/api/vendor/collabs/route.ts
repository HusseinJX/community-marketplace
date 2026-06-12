import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getVendorProfile } from '@/lib/vendor-connect'

// Proxy to the connector-agent collab-room API. The shared key never reaches
// the browser; the acting member_id is taken from the authenticated vendor
// profile, never from the client, so a vendor can only act as themselves.
const CONNECTOR_URL = process.env.CONNECTOR_URL ?? ''
const KEY = process.env.CONNECTOR_MARKETPLACE_KEY ?? ''

function connectorHeaders() {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` }
}

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await getVendorProfile(userId)
  if (!profile) return NextResponse.json({ error: 'No vendor profile' }, { status: 403 })

  const res = await fetch(
    `${CONNECTOR_URL}/.netlify/functions/room?memberId=${encodeURIComponent(profile.member_id)}`,
    { headers: connectorHeaders(), cache: 'no-store' },
  )
  const data = await res.json()
  if (!res.ok) return NextResponse.json({ error: data.error ?? 'Failed to load rooms' }, { status: res.status })
  // Expose the caller's member_id so the client can align "me" vs others.
  return NextResponse.json({ memberId: profile.member_id, ...data })
}

export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await getVendorProfile(userId)
  if (!profile) return NextResponse.json({ error: 'No vendor profile' }, { status: 403 })

  const { action, roomId, text, vote } = await request.json()
  if (!['messages', 'send', 'vote'].includes(action)) {
    return NextResponse.json({ error: 'unknown action' }, { status: 400 })
  }

  const res = await fetch(`${CONNECTOR_URL}/.netlify/functions/room`, {
    method: 'POST',
    headers: connectorHeaders(),
    body: JSON.stringify({ action, roomId, memberId: profile.member_id, text, vote }),
  })
  const data = await res.json()
  if (!res.ok) return NextResponse.json({ error: data.error ?? 'Request failed' }, { status: res.status })
  return NextResponse.json({ memberId: profile.member_id, ...data })
}
