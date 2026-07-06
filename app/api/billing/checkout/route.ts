import { NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { resolveActor } from '@/lib/admin'
import { createCheckoutSession } from '@/lib/subscriptions'
import type { Plan } from '@/lib/entitlements'

export const runtime = 'nodejs'

// Start a subscription Checkout for the signed-in vendor's linked member.
// Only the self-serve plans (member / pro) are purchasable here.
export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { plan, memberId: requested } = (await req.json().catch(() => ({}))) as {
    plan?: Plan
    memberId?: string
  }
  if (plan !== 'member' && plan !== 'pro') {
    return NextResponse.json({ error: 'invalid_plan' }, { status: 400 })
  }

  const actor = await resolveActor(requested)
  if (!actor || actor.isDemo) {
    return NextResponse.json({ error: 'no_member' }, { status: 403 })
  }

  const user = await currentUser()
  const email = user?.primaryEmailAddress?.emailAddress ?? null

  const result = await createCheckoutSession(actor.memberId, plan, email)
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 502 })
  }
  return NextResponse.json(result)
}
