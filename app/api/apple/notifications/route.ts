import { NextResponse } from 'next/server'
import { appleIapConfigured, syncFromNotification } from '@/lib/apple-iap'

export const runtime = 'nodejs'

// App Store Server Notifications V2 — Apple's durable webhook for the whole
// subscription lifecycle (renewals, expirations, refunds, revokes, billing
// retries). This is the equivalent of the Stripe subscription webhook: it keeps
// the `subscriptions` table correct over time without the app being open.
//
// Authenticity is the signature itself: the body is `{ signedPayload }`, a JWS
// signed by Apple, verified against Apple's root CAs in lib/apple-iap. No shared
// secret — an unverifiable payload is rejected. Set this URL in App Store Connect
// (App Information → App Store Server Notifications, Version 2).
export async function POST(req: Request) {
  if (!appleIapConfigured()) {
    return NextResponse.json({ error: 'not_configured' }, { status: 503 })
  }

  const { signedPayload } = (await req.json().catch(() => ({}))) as { signedPayload?: string }
  if (!signedPayload || typeof signedPayload !== 'string') {
    return NextResponse.json({ error: 'missing_payload' }, { status: 400 })
  }

  try {
    await syncFromNotification(signedPayload)
    // Always 200 on a verified payload so Apple stops retrying, even when the
    // transaction isn't bound to a member yet (nothing for us to do).
    return NextResponse.json({ received: true })
  } catch (e) {
    // Verification failure (bad signature / wrong bundle) → 400 so it's visible.
    console.error('[apple notifications] verify/sync failed', e)
    return NextResponse.json({ error: 'invalid_payload' }, { status: 400 })
  }
}
