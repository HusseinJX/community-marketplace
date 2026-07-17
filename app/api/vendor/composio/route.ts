import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getVendorProfile } from '@/lib/vendor-connect'
import { connectStore, syncVendorCatalog, finalizeConnection } from '@/lib/composio-commerce'
import { isSupportedPlatform } from '@/lib/composio'
import { syncVendorCatalogTask } from '@/trigger/composio'
import { gateCapability } from '@/lib/gate'
import { isAdmin } from '@/lib/admin'

// Native Composio commerce endpoint (no longer a proxy to the connector-agent).
//
// POST { action: 'connect', platform: 'shopify'|'square' }  → OAuth magic link
// POST { action: 'sync' }                                   → catalog sync
//
// Sync is dispatched to the Trigger.dev `sync-vendor-catalog` task when
// TRIGGER_SECRET_KEY is configured (observable, retriable). Before Trigger.dev
// is wired up it falls back to a direct in-request sync so the button still
// works as soon as COMPOSIO_API_KEY is set.
export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await getVendorProfile(userId)
  if (!profile) return NextResponse.json({ error: 'No vendor profile' }, { status: 403 })

  const { action, platform, subdomain } = await request.json()
  const memberId = profile.member_id

  // Connecting/syncing a shop is a Pro capability.
  const gated = await gateCapability(memberId, 'commerce', { bypass: isAdmin(userId) })
  if (gated) return gated

  if (action === 'connect') {
    if (!isSupportedPlatform(platform)) {
      return NextResponse.json({ error: 'platform must be shopify or square' }, { status: 400 })
    }
    try {
      const { url } = await connectStore(memberId, platform, { subdomain })
      return NextResponse.json({ url })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Connect failed'
      return NextResponse.json({ error: message }, { status: 500 })
    }
  }

  // Called by the ?connected= callback: confirms the OAuth actually completed
  // before we record the store as connected.
  if (action === 'finalize') {
    if (!isSupportedPlatform(platform)) {
      return NextResponse.json({ error: 'platform must be shopify or square' }, { status: 400 })
    }
    try {
      const connected = await finalizeConnection(memberId, platform)
      return NextResponse.json({ connected })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not confirm connection'
      return NextResponse.json({ error: message }, { status: 500 })
    }
  }

  if (action === 'sync') {
    try {
      if (process.env.TRIGGER_SECRET_KEY) {
        const handle = await syncVendorCatalogTask.trigger({ memberId })
        return NextResponse.json({ triggered: true, runId: handle.id })
      }
      // Trigger.dev not configured yet — sync inline so the button still works.
      const result = await syncVendorCatalog(memberId)
      return NextResponse.json(result)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sync failed'
      return NextResponse.json({ error: message }, { status: 500 })
    }
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
