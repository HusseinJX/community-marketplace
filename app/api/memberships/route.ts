import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getMembershipsForUser, getPlan } from '@/lib/memberships'
import { getMember } from '@/lib/api'

export const runtime = 'nodejs'

// The shopper's own memberships, with enough of the business and the tier
// attached to render a card. Scoped to the caller — there is no memberId
// parameter to tamper with.
export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ memberships: [] })

  const rows = await getMembershipsForUser(userId)
  const detailed = await Promise.all(
    rows.map(async (m) => {
      const [plan, business] = await Promise.all([
        getPlan(m.plan_id),
        getMember(m.member_id)
          .then((r) => r.member)
          .catch(() => null),
      ])
      return {
        ...m,
        plan_name: plan?.name ?? 'Membership',
        perks: plan?.perks ?? [],
        discount_percent: plan?.discount_percent ?? null,
        business_name: business?.profile?.businessName ?? business?.profile?.name ?? 'A local business',
        business_image: business?.profile?.images?.[0] ?? null,
      }
    })
  )
  return NextResponse.json({ memberships: detailed })
}
