import { NextResponse } from 'next/server'
import { getMemberAdmin } from '@/lib/api'
import { placeDetails } from '@/lib/places'
import { hit, rateLimit } from '@/lib/rate-limit'
import { maskPhone, resolveOwnershipPhone, toE164, writeProof } from '@/lib/join-proof'
import { sendCode, verifyConfigured } from '@/lib/twilio-verify'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST { placeId } | { memberId }, optional { channel: "call" }
//
// Send the ownership code — BEFORE the person has an account (2026-10-01; see
// lib/join-proof.ts for why the order changed). Nothing is written: the code
// goes out, a short-lived signed cookie remembers where it went, and that is all.
//
// Every code is Twilio Verify, sent from here. The number is NEVER taken from
// the client: a placeId is looked up on Google, a memberId resolves the page's
// own ownership phone (lib/join-proof resolveOwnershipPhone). "Text this number" from the browser would let anyone prove
// they own any business by typing their own number.
//
// Anonymous and it costs money per call, so it is limited three ways: per IP,
// per target (a business can't be spammed from many IPs), and Twilio's own
// attempt caps behind both.
export async function POST(req: Request) {
  const limited = rateLimit({ req, name: 'join-otp-send', id: null, limit: 5, windowMs: 600_000, ipLimit: 5 })
  if (limited) return limited

  const body = await req.json().catch(() => ({}))
  const placeId = typeof body.placeId === 'string' ? body.placeId.trim() : ''
  const memberId = typeof body.memberId === 'string' ? body.memberId.trim() : ''
  const channel: 'sms' | 'call' = body.channel === 'call' ? 'call' : 'sms'
  if (!placeId && !memberId) {
    return NextResponse.json({ error: 'placeId or memberId required' }, { status: 400 })
  }

  const target = placeId ? `place:${placeId}` : `member:${memberId}`
  if (!hit(`join-otp-send:target:${target}`, 4, 3_600_000).ok) {
    return NextResponse.json(
      { sent: false, error: "We've sent a few codes to this business already. Wait a while and try again." },
      { status: 429 },
    )
  }

  if (!verifyConfigured()) {
    return NextResponse.json({ sent: false, error: 'Verification is not available right now.' }, { status: 503 })
  }
  const NO_PHONE =
    "This listing has no phone number we can text, so we can't verify it automatically. Message our team and we'll sort it out."

  // ── An existing page (canvassed, carded) ─────────────────────────────────
  // Same Twilio Verify call as a fresh listing. The number is the page's own
  // ownership phone, resolved here — the connector is not involved until the
  // claim itself.
  if (memberId) {
    let member: Awaited<ReturnType<typeof getMemberAdmin>> = null
    try {
      member = await getMemberAdmin(memberId)
    } catch {
      return NextResponse.json({ sent: false, error: "Couldn't load that page. Try again." }, { status: 502 })
    }
    if (!member) return NextResponse.json({ error: 'No such page' }, { status: 404 })
    // Explicitly "unclaimed" or nothing. A claimed page says "claimed", but a
    // page someone made for themselves has no status at all — and the
    // connector's claim-profile only refuses the literal "claimed".
    if (member.status !== 'unclaimed') {
      return NextResponse.json({ sent: false, error: 'This page has already been claimed.' }, { status: 409 })
    }

    const p = member.profile
    const phone = await resolveOwnershipPhone(p)
    if (!phone) return NextResponse.json({ sent: false, reason: 'no_phone', error: NO_PHONE }, { status: 422 })

    const r = await sendCode(phone, channel)
    if (!r.sent) {
      console.error('join/verify/send: twilio refused:', r.error)
      return NextResponse.json({ sent: false, error: 'Could not send a code to that number.' }, { status: 502 })
    }
    const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)
    await writeProof(
      { kind: 'member', memberId, name: str(p.businessName) ?? str(p.name) ?? '', city: str(p.city) },
      'sent',
      phone,
    )
    return NextResponse.json({ sent: true, phoneHint: maskPhone(phone), channel })
  }

  // ── A Google listing that isn't on WhatsLocal yet ────────────────────────
  const details = await placeDetails(placeId)
  if (!details) return NextResponse.json({ sent: false, error: "Couldn't load that listing." }, { status: 404 })

  const phone = toE164(details.internationalPhone, details.phone)
  if (!phone) {
    return NextResponse.json(
      {
        sent: false,
        reason: 'no_phone',
        error: NO_PHONE,
        details,
      },
      { status: 422 },
    )
  }

  const r = await sendCode(phone, channel)
  if (!r.sent) {
    console.error('join/verify/send: twilio refused:', r.error)
    return NextResponse.json({ sent: false, error: 'Could not send a code to that number.' }, { status: 502 })
  }
  await writeProof({ kind: 'place', placeId, name: details.name, city: details.city }, 'sent', phone)

  // The listing comes back with the confirmation. It is all public, it was
  // just paid for, and it is what the findings, the links and the page are
  // built from — the browser never has to ask Google itself.
  return NextResponse.json({ sent: true, phoneHint: maskPhone(phone), channel, details })
}
