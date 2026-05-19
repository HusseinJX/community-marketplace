import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getVendorProfile } from '@/lib/vendor-connect'

const CONNECTOR_URL = process.env.CONNECTOR_URL ?? ''
const ADMIN_TOKEN = process.env.CONNECTOR_ADMIN_TOKEN ?? ''

function connectorHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${ADMIN_TOKEN}`,
  }
}

// POST { action: 'connect', platform: 'shopify'|'square' }
// POST { action: 'sync' }
export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await getVendorProfile(userId)
  if (!profile) return NextResponse.json({ error: 'No vendor profile' }, { status: 403 })

  const { action, platform } = await request.json()

  if (action === 'connect') {
    if (!['shopify', 'square'].includes(platform)) {
      return NextResponse.json({ error: 'platform must be shopify or square' }, { status: 400 })
    }
    const res = await fetch(`${CONNECTOR_URL}/.netlify/functions/composio-connect`, {
      method: 'POST',
      headers: connectorHeaders(),
      body: JSON.stringify({ memberId: profile.member_id, platform }),
    })
    const data = await res.json()
    if (!res.ok) return NextResponse.json({ error: data.error ?? 'Connect failed' }, { status: res.status })
    return NextResponse.json({ url: data.url })
  }

  if (action === 'sync') {
    const res = await fetch(`${CONNECTOR_URL}/.netlify/functions/composio-sync`, {
      method: 'POST',
      headers: connectorHeaders(),
      body: JSON.stringify({ memberId: profile.member_id }),
    })
    const data = await res.json()
    if (!res.ok) return NextResponse.json({ error: data.error ?? 'Sync failed' }, { status: res.status })
    return NextResponse.json(data)
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
