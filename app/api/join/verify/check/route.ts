import { NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'
import { readProof, writeProof } from '@/lib/join-proof'
import { checkCode } from '@/lib/twilio-verify'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST { code } — check the ownership code sent by /api/join/verify/send.
//
// WHICH business is read from the signed cookie that send wrote, never from
// the body: the code only ever proves the number it was sent to.
//
// On success the cookie is upgraded to `verified`. That is still not a claim —
// nothing is written to the page until /api/join/commit, after sign-in.
export async function POST(req: Request) {
  const limited = rateLimit({ req, name: 'join-otp-check', id: null, limit: 10, windowMs: 600_000, ipLimit: 10 })
  if (limited) return limited

  const proof = await readProof()
  if (!proof) {
    return NextResponse.json({ verified: false, error: 'That code has expired. Send a new one.' }, { status: 400 })
  }
  if (proof.stage === 'verified') return NextResponse.json({ verified: true })

  const body = await req.json().catch(() => ({}))
  const code = String(body.code ?? '').replace(/\s/g, '')
  if (code.length < 4) return NextResponse.json({ verified: false, error: 'Enter the 6-digit code.' }, { status: 400 })

  // Twilio checks the code against the number send wrote into the cookie —
  // for a fresh listing and an existing page alike.
  if (!proof.phone) return NextResponse.json({ verified: false, error: 'Send a new code.' }, { status: 400 })
  const ok = await checkCode(proof.phone, code).catch(() => false)

  if (!ok) {
    return NextResponse.json({ verified: false, error: "That code didn't match the business's number." }, { status: 200 })
  }
  await writeProof(proof.target, 'verified', proof.phone)
  return NextResponse.json({ verified: true })
}
