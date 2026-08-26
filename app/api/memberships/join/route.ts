import { NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { getPlan, createJoinSession } from '@/lib/memberships'
import { getConnectPayoutState } from '@/lib/connect-status'
import { rateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'

// Start a membership. The client sends a plan id and NOTHING else that costs
// money: the price, the interval, the business and our 5% all come off the plan
// row the server reads. Same invariant as the shop — the server derives.
export async function POST(req: Request) {
  const { userId } = await auth()
  // Unlike a one-off sale, a membership cannot be a guest: a renewal needs
  // somebody to renew for, and "my memberships" needs somebody to belong to.
  if (!userId) return NextResponse.json({ error: 'sign_in_required' }, { status: 401 })

  const limited = rateLimit({ req, name: 'membership-join', id: userId, limit: 10, windowMs: 60_000 })
  if (limited) return limited

  const { planId, returnPath } = (await req.json().catch(() => ({}))) as {
    planId?: string
    returnPath?: string
  }
  if (!planId) return NextResponse.json({ error: 'planId required' }, { status: 400 })

  const plan = await getPlan(planId)
  if (!plan || !plan.active) return NextResponse.json({ error: 'plan_unavailable' }, { status: 404 })

  // The business must be able to receive money before we take any. Without this
  // the charge fails at Stripe with a worse error, after the card is entered.
  const payouts = await getConnectPayoutState(plan.member_id)
  if (!payouts.accountId || !payouts.active) {
    return NextResponse.json({ error: 'vendor_not_ready' }, { status: 409 })
  }

  const user = await currentUser()
  const result = await createJoinSession({
    plan,
    clerkUserId: userId,
    email: user?.primaryEmailAddress?.emailAddress ?? null,
    name: user?.fullName ?? null,
    connectAccountId: payouts.accountId,
    returnPath: typeof returnPath === 'string' && returnPath.startsWith('/') ? returnPath : undefined,
  })
  if (result.error) {
    const status = result.error === 'already_member' ? 409 : 500
    return NextResponse.json({ error: result.error }, { status })
  }
  return NextResponse.json({ url: result.url })
}
