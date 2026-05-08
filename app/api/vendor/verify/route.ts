import { NextResponse } from 'next/server'
import { withAuth } from '@workos-inc/authkit-nextjs'
import { getMember } from '@/lib/api'
import { setVendorProfile } from '@/lib/vendor-connect'
import { verifyBusinessOwnership, availableVerificationMethods } from '@/lib/vendor-verify'
import type { VerificationMethod } from '@/lib/vendor-verify'

export async function POST(request: Request) {
  const { user } = await withAuth()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { memberId, method, value }: { memberId: string; method: VerificationMethod; value: string } = body

  if (!memberId || !method || !value) {
    return NextResponse.json({ error: 'memberId, method, and value are required' }, { status: 400 })
  }

  const { member } = await getMember(memberId)
  const profile = member.profile ?? {}

  const available = availableVerificationMethods(profile)
  if (!available.includes(method)) {
    return NextResponse.json({ error: 'Verification method not available for this member' }, { status: 400 })
  }

  const result = await verifyBusinessOwnership(method, value, profile)

  if (result.verified) {
    await setVendorProfile(user.id, memberId, user.email ?? null, 'verified', method, result.evidence)
    return NextResponse.json({ verified: true, method: result.method })
  }

  // If structured check failed, escalate to Gemini automatically
  if (method !== 'gemini') {
    const geminiResult = await verifyBusinessOwnership('gemini', value, profile)
    if (geminiResult.verified) {
      await setVendorProfile(user.id, memberId, user.email ?? null, 'verified', 'gemini', geminiResult.evidence)
      return NextResponse.json({ verified: true, method: 'gemini' })
    }
  }

  return NextResponse.json({ verified: false, evidence: result.evidence })
}
