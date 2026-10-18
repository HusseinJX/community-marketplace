import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createMember, getMemberAdmin, patchMember } from '@/lib/api'
import { placeDetails } from '@/lib/places'
import { finishClaim, profileFromPlace } from '@/lib/claim'
import { clearProof, readVerifiedProof } from '@/lib/join-proof'
import { invalidateMembers } from '@/lib/cache'
import type { MemberProfile } from '@/lib/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST { kind, ownerName, ownerRole } — the moment a verified listing becomes
// a page owned by this account.
//
// This is the FIRST write of /join (2026-10-01). Everything before it — the
// code, the findings, the links typed in — happened without an account and
// wrote nothing. Two things are needed here and both are checked on the server:
//
//   a Clerk session      — whose page it will be
//   a VERIFIED proof     — the signed cookie /api/join/verify/check upgraded,
//                          which says this browser answered a code on the
//                          business's own number
//
// The business itself comes from Google again, by placeId, not from the body.
export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Sign in to finish' }, { status: 401 })

  const proof = await readVerifiedProof()
  if (!proof) {
    return NextResponse.json(
      { error: 'Your verification expired. Verify the business number again to continue.' },
      { status: 403 },
    )
  }

  const body = await req.json().catch(() => ({}))
  const kind = body.kind === 'organizer' ? 'organizer' : 'vendor'
  const ownerName = typeof body.ownerName === 'string' ? body.ownerName.trim().slice(0, 120) : ''
  const ownerRole = typeof body.ownerRole === 'string' ? body.ownerRole.trim().slice(0, 40) : ''
  if (!ownerName) return NextResponse.json({ error: 'Add your name.' }, { status: 400 })

  let memberId: string
  const evidence: Record<string, unknown> = { via: 'join', verifiedAt: proof.verifiedAt }

  if (proof.target.kind === 'member') {
    memberId = proof.target.memberId
    // Re-checked here, not just at send: the page may have been claimed in the
    // two hours this proof lives, and the stamp below must never land on a
    // page that already has an owner.
    let status: string | null | undefined
    try {
      status = (await getMemberAdmin(memberId))?.status
    } catch {
      return NextResponse.json({ error: "Couldn't load that page. Try again." }, { status: 502 })
    }
    if (status !== 'unclaimed') {
      await clearProof()
      return NextResponse.json({ error: 'This page has already been claimed.' }, { status: 409 })
    }
  } else {
    const details = await placeDetails(proof.target.placeId)
    if (!details) return NextResponse.json({ error: "Couldn't load your listing. Try again." }, { status: 502 })

    let created
    try {
      created = await createMember(
        { ...profileFromPlace(details, kind), ownerName, ownerRole: ownerRole || undefined },
        { source: 'qr_onboard' },
      )
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Couldn't create your page." },
        { status: 502 },
      )
    }
    memberId = created.id
    evidence.placeId = proof.target.placeId
    invalidateMembers()
  }
  if (proof.phone) evidence.phoneLast4 = proof.phone.slice(-4)

  // The record the connector's /verify used to write after a phone_otp check.
  // Every code is checked by Twilio on our side now (/api/join/verify/check),
  // so we write it — and claim-profile refuses without it.
  try {
    await patchMember(memberId, {
      ownershipVerification: {
        verified: true,
        method: 'phone_otp',
        evidence,
        verifiedAt: proof.verifiedAt ?? new Date().toISOString(),
        verifiedValue: null,
      },
    } as unknown as Partial<MemberProfile>)
  } catch (err) {
    console.error('join/commit: verification stamp failed:', err)
    return NextResponse.json({ error: "Couldn't record your verification. Try again." }, { status: 502 })
  }

  const done = await finishClaim({ memberId, userId, method: 'phone_otp', evidence, ownerName, ownerRole })
  if (!done.ok) return NextResponse.json({ error: done.error }, { status: done.status })

  // Single use. A second commit would mint a second page for the same listing.
  await clearProof()
  return NextResponse.json({ memberId })
}
