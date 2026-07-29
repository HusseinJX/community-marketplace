import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { resolveActor } from '@/lib/admin'
import { rateLimit } from '@/lib/rate-limit'
import { appleIapConfigured, grantFromSignedTransaction } from '@/lib/apple-iap'

export const runtime = 'nodejs'

// Fast path for a StoreKit purchase in the iOS app. The client sends the signed
// transaction (jwsRepresentation) right after a successful purchase; we verify
// it with Apple's certs and grant the plan immediately so the UI unlocks without
// waiting for the (durable) App Store Server Notification. Clerk-authed so the
// grant is bound to the signed-in member. NEVER trusts a client-claimed plan —
// the plan is derived from the verified productId only.
export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const limited = rateLimit({ req, name: 'iap-verify', id: userId, limit: 20, windowMs: 60_000 })
  if (limited) return limited

  if (!appleIapConfigured()) {
    return NextResponse.json({ error: 'not_configured' }, { status: 503 })
  }

  const { jws, memberId: requested } = (await req.json().catch(() => ({}))) as {
    jws?: string
    memberId?: string
  }
  if (!jws || typeof jws !== 'string') {
    return NextResponse.json({ error: 'missing_transaction' }, { status: 400 })
  }

  const actor = await resolveActor(requested)
  if (!actor || actor.isDemo) {
    return NextResponse.json({ error: 'no_member' }, { status: 403 })
  }

  try {
    const plan = await grantFromSignedTransaction(actor.memberId, jws)
    return NextResponse.json({ ok: true, plan })
  } catch (e) {
    console.error('[iap verify] failed', e)
    return NextResponse.json({ error: 'verification_failed' }, { status: 400 })
  }
}
