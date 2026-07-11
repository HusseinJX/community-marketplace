import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getVendorProfile, setVendorProfile } from '@/lib/vendor-connect'

// GET — does the signed-in user already have a linked business/artist/org
// profile? A `vendor_profiles` row is the single completion signal: vendors,
// orgs, and artists all get one at the end of onboarding; shoppers never do.
// `/join` uses this to route a returning scan straight to the dashboard.
export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ memberId: null }, { status: 401 })
  const profile = await getVendorProfile(userId)
  return NextResponse.json({ memberId: profile?.member_id ?? null })
}

export async function POST(request: Request) {
  const { userId, sessionClaims } = await auth()

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { memberId }: { memberId: string } = body

  if (!memberId) {
    return NextResponse.json({ error: 'memberId is required' }, { status: 400 })
  }

  const email = (sessionClaims?.email as string) ?? null
  await setVendorProfile(userId, memberId, email)

  return NextResponse.json({ ok: true })
}
