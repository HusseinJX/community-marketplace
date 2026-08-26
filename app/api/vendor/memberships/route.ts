import { NextResponse } from 'next/server'
import { resolveActor } from '@/lib/admin'
import {
  getPlansByMember,
  getMembersForVendor,
  monthlyRevenueCents,
  createPlan,
  updatePlan,
  retirePlan,
  ENTITLED_STATUSES,
  type PlanInput,
} from '@/lib/memberships'

export const runtime = 'nodejs'

// The vendor's side: their tiers, their members, and what it adds up to.
// Every write goes through resolveActor, so a member_id in the body can never
// reach another business's rows.

export async function GET() {
  const actor = await resolveActor()
  if (!actor) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const [plans, members] = await Promise.all([
    getPlansByMember(actor.memberId),
    getMembersForVendor(actor.memberId),
  ])
  const live = members.filter((m) => (ENTITLED_STATUSES as unknown as string[]).includes(m.status))
  return NextResponse.json({
    plans,
    members,
    stats: {
      active: live.length,
      canceling: live.filter((m) => m.cancel_at_period_end).length,
      monthlyRevenueCents: monthlyRevenueCents(members),
    },
  })
}

export async function POST(req: Request) {
  const actor = await resolveActor()
  if (!actor) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (actor.isDemo) return NextResponse.json({ error: 'demo' }, { status: 403 })

  const body = (await req.json().catch(() => ({}))) as Partial<PlanInput>
  if (!body.name || !body.price_cents || Number(body.price_cents) <= 0) {
    return NextResponse.json({ error: 'name and price required' }, { status: 400 })
  }
  const plan = await createPlan(actor.memberId, {
    name: body.name,
    description: body.description ?? null,
    price_cents: Number(body.price_cents),
    billing_interval: body.billing_interval === 'year' ? 'year' : 'month',
    discount_percent: body.discount_percent ?? null,
    perks: body.perks ?? [],
  })
  return NextResponse.json({ plan })
}

export async function PATCH(req: Request) {
  const actor = await resolveActor()
  if (!actor) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (actor.isDemo) return NextResponse.json({ error: 'demo' }, { status: 403 })

  const { id, ...patch } = (await req.json().catch(() => ({}))) as { id?: string } & Partial<PlanInput>
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const plan = await updatePlan(id, actor.memberId, patch)
  if (!plan) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  return NextResponse.json({ plan })
}

// Retire, never delete: people are still paying for it. See lib/memberships.
export async function DELETE(req: Request) {
  const actor = await resolveActor()
  if (!actor) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (actor.isDemo) return NextResponse.json({ error: 'demo' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const ok = await retirePlan(id, actor.memberId)
  return NextResponse.json({ ok })
}
