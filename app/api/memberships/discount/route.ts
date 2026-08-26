import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { memberDiscountPercent } from '@/lib/memberships'

export const runtime = 'nodejs'

// What this buyer's membership takes off at this business — for DISPLAY only.
// The charge is priced independently in create-payment-intent from the same
// function, so a tampered answer here changes a label and nothing else.
export async function GET(req: Request) {
  const memberId = new URL(req.url).searchParams.get('memberId')
  if (!memberId) return NextResponse.json({ percent: 0 })
  const { userId } = await auth()
  return NextResponse.json({ percent: await memberDiscountPercent(userId, memberId) })
}
