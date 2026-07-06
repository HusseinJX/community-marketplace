import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { resolveActor } from '@/lib/admin'
import { createPortalSession } from '@/lib/subscriptions'

export const runtime = 'nodejs'

// Open the Stripe Billing Portal for the signed-in vendor to manage/cancel.
export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { memberId: requested } = (await req.json().catch(() => ({}))) as { memberId?: string }
  const actor = await resolveActor(requested)
  if (!actor || actor.isDemo) {
    return NextResponse.json({ error: 'no_member' }, { status: 403 })
  }

  const result = await createPortalSession(actor.memberId)
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }
  return NextResponse.json(result)
}
