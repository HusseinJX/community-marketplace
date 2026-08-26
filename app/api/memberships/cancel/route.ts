import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { cancelMembership, resumeMembership } from '@/lib/memberships'

export const runtime = 'nodejs'

// Stop (or un-stop) a membership. Ownership is checked against the Clerk user
// inside lib/memberships — the id in the body is not enough on its own.
export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'sign_in_required' }, { status: 401 })

  const { membershipId, resume } = (await req.json().catch(() => ({}))) as {
    membershipId?: string
    resume?: boolean
  }
  if (!membershipId) return NextResponse.json({ error: 'membershipId required' }, { status: 400 })

  const result = resume
    ? await resumeMembership(membershipId, userId)
    : await cancelMembership(membershipId, userId)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.error === 'not_found' ? 404 : 500 })
  }
  return NextResponse.json({ ok: true })
}
