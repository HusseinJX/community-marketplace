import { NextResponse } from 'next/server'
import { getActivePlans, type MembershipPlan } from '@/lib/memberships'
import { fetchAllMembers } from '@/lib/landing'
import { memberImages } from '@/lib/member-images'

export const runtime = 'nodejs'
export const revalidate = 60

export interface PublicMembershipPlan extends MembershipPlan {
  memberName: string
  memberCategory: string | null
  memberImage: string | null
  /**
   * True for the placeholder plans below — the ones shown while no business
   * has published a real membership yet. They exist to show what the page is
   * FOR, and nothing behind them exists: their ids are not rows, so
   * /api/memberships/join answers 404 for every one of them. The card reads
   * this and offers an example, not a Join button that cannot work.
   */
  demo?: boolean
}

const DEMO_PLANS: PublicMembershipPlan[] = [
  {
    demo: true,
    id: 'demo-membership-mma',
    member_id: 'demo-courtside-sports-bar',
    memberName: 'Courtside Sports Bar',
    memberCategory: 'Sports bar',
    memberImage: 'https://images.unsplash.com/photo-1517438322307-e67111335449?auto=format&fit=crop&w=900&q=80',
    name: 'Game Day Club',
    description: 'A monthly membership for regulars who come through for big matches and watch parties.',
    price_cents: 2900,
    billing_interval: 'month',
    discount_percent: 10,
    perks: ['Reserved watch-party access', 'One guest pass each month', 'Member wing specials'],
    stripe_price_id: null,
    active: true,
    sort_order: 1,
    created_at: '2026-08-01T00:00:00.000Z',
    updated_at: '2026-08-01T00:00:00.000Z',
  },
  {
    demo: true,
    id: 'demo-membership-pottery',
    member_id: 'demo-dani-cruz',
    memberName: 'Dani Cruz',
    memberCategory: 'Art workshops',
    memberImage: 'https://images.unsplash.com/photo-1493106819501-66d381c466f1?auto=format&fit=crop&w=900&q=80',
    name: 'Workshop Studio Pass',
    description: 'A recurring workshop membership for hands-on art nights and community classes.',
    price_cents: 8900,
    billing_interval: 'month',
    discount_percent: null,
    perks: ['Four studio sessions monthly', 'Shelf space for works in progress', 'Clay member pricing'],
    stripe_price_id: null,
    active: true,
    sort_order: 2,
    created_at: '2026-08-02T00:00:00.000Z',
    updated_at: '2026-08-02T00:00:00.000Z',
  },
  {
    demo: true,
    id: 'demo-membership-yoga',
    member_id: 'demo-casa-verde',
    memberName: 'Casa Verde Plant Co',
    memberCategory: 'Plant shop',
    memberImage: 'https://images.unsplash.com/photo-1540206276207-3af25c08abc4?auto=format&fit=crop&w=900&q=80',
    name: 'Workshop Pass',
    description: 'A recurring membership for plant care classes, propagation sessions, and workshops.',
    price_cents: 6900,
    billing_interval: 'month',
    discount_percent: 15,
    perks: ['Two workshops monthly', 'Free potting station access', 'Priority class booking'],
    stripe_price_id: null,
    active: true,
    sort_order: 3,
    created_at: '2026-08-03T00:00:00.000Z',
    updated_at: '2026-08-03T00:00:00.000Z',
  },
]

export async function GET() {
  try {
    const [plans, members] = await Promise.all([getActivePlans(24), fetchAllMembers()])
    const byId = new Map(members.map((member) => [member.id, member]))
    const publicPlans: PublicMembershipPlan[] = plans.map((plan) => {
      const member = byId.get(plan.member_id)
      const profile = member?.profile ?? {}
      return {
        ...plan,
        memberName: String(profile.name || profile.businessName || 'Local business'),
        memberCategory:
          typeof profile.category === 'string'
            ? profile.category
            : typeof profile.businessCategory === 'string'
              ? profile.businessCategory
              : null,
        memberImage: member ? memberImages(member)[0] ?? null : null,
      }
    })
    return NextResponse.json({ plans: publicPlans.length ? publicPlans : DEMO_PLANS })
  } catch {
    return NextResponse.json({ plans: DEMO_PLANS })
  }
}
