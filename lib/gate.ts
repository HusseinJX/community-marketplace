import { NextResponse } from 'next/server'
import { getEntitlements, PLANS, type Capability, type Plan } from '@/lib/entitlements'

// Server-side capability gate for API routes. Returns a 402 upgrade response the
// route should return immediately when the member lacks the capability, or null
// to proceed. Admins (isAdmin actors) should be checked by the caller before
// gating if they need to bypass — pass `bypass: true`.
export async function gateCapability(
  memberId: string,
  cap: Capability,
  opts: { bypass?: boolean } = {}
): Promise<NextResponse | null> {
  if (opts.bypass) return null
  const ent = await getEntitlements(memberId)
  if (ent.can[cap]) return null
  return NextResponse.json(
    { error: 'upgrade_required', capability: cap, plan: ent.plan, requires: capabilityPlan(cap) },
    { status: 402 }
  )
}

// The lowest plan that grants a capability — for a helpful upgrade message.
// Derived from PLANS rather than a second hand-maintained list: the old copy
// still claimed `textAssistant` was a Member capability, and would have gone on
// claiming commerce was Pro after it went free.
function capabilityPlan(cap: Capability): Plan {
  const ascending: Plan[] = ['free', 'member', 'pro', 'enterprise']
  return ascending.find((p) => PLANS[p].can[cap]) ?? 'pro'
}
