import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getVendorProfile } from '@/lib/vendor-connect'
import { isAdmin } from '@/lib/admin'
import { getMember } from '@/lib/api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Who /join is being pointed at, when it is pointed at an EXISTING member.
//
// Two ways that happens, and they are two stages of the same thing:
//
//   stage "claim"  — /join?claim=<id>. Somebody tapped "Is this your business?"
//                    on a page that already exists (a listing canvassed off the
//                    map, an NFC card, a QR on a table). They have not signed in
//                    yet and they own nothing yet, so this returns only what the
//                    public profile page already shows: name, kind, city.
//   stage "resume" — /join?claimed=<id>. They have proved ownership and are
//                    picking the rest of onboarding back up.
//
// The STAGE is decided here, not by the caller: the id sits in a URL anyone can
// edit, and everything downstream writes to whatever member it is handed.
export async function GET(req: Request) {
  const memberId = new URL(req.url).searchParams.get('memberId')?.trim()
  if (!memberId) return NextResponse.json({ error: 'memberId is required' }, { status: 400 })

  const { userId } = await auth()
  const profile = userId ? await getVendorProfile(userId).catch(() => null) : null
  const owns = !!profile && profile.member_id === memberId

  let member: { status?: string; profile?: Record<string, unknown> } | null = null
  try {
    member = ((await getMember(memberId)) as { member?: { status?: string; profile?: Record<string, unknown> } })
      ?.member ?? null
  } catch {
    member = null
  }
  if (!member) return NextResponse.json({ error: 'No such page' }, { status: 404 })

  const stage = owns || (userId && isAdmin(userId)) ? 'resume' : 'claim'

  // Somebody else already owns it. Not "unauthorized" — nothing was attempted —
  // but there is no claim left to make, and saying so beats an OTP that will
  // never arrive.
  if (stage === 'claim' && member.status && member.status !== 'unclaimed') {
    return NextResponse.json({ error: 'This page has already been claimed.' }, { status: 409 })
  }

  const p = member.profile ?? {}
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)

  return NextResponse.json({
    stage,
    memberId,
    name: str(p.businessName) ?? str(p.name) ?? '',
    memberType: str(p.memberType) ?? 'vendor',
    // The address the listing already carries — shown on the claim screen so
    // the person can see they are claiming the right shop, the same way the
    // Google search result is shown to someone joining the long way.
    address: str(p.businessAddress) ?? str(p.address),
    // What the interview opens knowing. For a canvassed profile that is already
    // a real category and neighbourhood, paid for by the Places call that made
    // it. Everything here is on the public profile page.
    seed: {
      name: str(p.businessName) ?? str(p.name),
      category: str(p.category) ?? str(p.businessCategory),
      city: str(p.city),
      neighborhood: str(p.neighborhood),
      description: str(p.businessDescription) ?? str(p.bio),
      address: str(p.businessAddress),
      websiteUrl: str(p.websiteUrl),
      instagramHandle: str(p.instagramHandle),
    },
  })
}
