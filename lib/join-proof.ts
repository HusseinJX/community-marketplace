import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'
import { placeDetails } from '@/lib/places'

/**
 * Proof that THIS BROWSER answered a code sent to a business's own number —
 * held before the person has an account.
 *
 * WHY THIS EXISTS (2026-10-01). /join used to sign in first and verify second,
 * because every write needs an account. The order is now find → verify →
 * findings → links → sign in, so the ownership check happens to someone
 * anonymous. Nothing is WRITTEN at that point (no member row, no claim): the
 * only thing that changes is this cookie. The commit after sign-in reads it,
 * and the server rebuilds the page from the placeId — it never trusts the
 * client for a fact about the business.
 *
 * Signed, httpOnly, short-lived. It binds the proof to the browser that earned
 * it; a code read out on someone else's phone does nothing for you.
 */

export const JOIN_PROOF_COOKIE = 'join_proof'

export type ProofTarget =
  /** A Google listing that is not on WhatsLocal yet — nothing exists to claim. */
  | { kind: 'place'; placeId: string; name: string; city: string | null }
  /** A page that already exists (canvassed, carded) — /join?claim=<id>. */
  | { kind: 'member'; memberId: string; name: string; city: string | null }

export interface JoinProof {
  v: 1
  target: ProofTarget
  /** Place targets only: the number the code went to, so the check uses the same one. */
  phone?: string
  stage: 'sent' | 'verified'
  verifiedAt?: string
  /** ms epoch */
  exp: number
}

const SENT_TTL_MS = 15 * 60 * 1000
// Long enough to read the findings, talk them through, add links and sign in.
const VERIFIED_TTL_MS = 2 * 60 * 60 * 1000

function secret(): string | null {
  return process.env.JOIN_PROOF_SECRET || process.env.CLERK_SECRET_KEY || null
}

function sign(body: string, key: string): string {
  return createHmac('sha256', key).update(body).digest('base64url')
}

export function encodeProof(p: JoinProof): string | null {
  const key = secret()
  if (!key) return null
  const body = Buffer.from(JSON.stringify(p)).toString('base64url')
  return `${body}.${sign(body, key)}`
}

export function decodeProof(raw: string | undefined | null): JoinProof | null {
  const key = secret()
  if (!raw || !key) return null
  const [body, mac] = raw.split('.')
  if (!body || !mac) return null
  const want = Buffer.from(sign(body, key))
  const got = Buffer.from(mac)
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as JoinProof
    if (p.v !== 1 || typeof p.exp !== 'number' || Date.now() > p.exp) return null
    return p
  } catch {
    return null
  }
}

export async function readProof(): Promise<JoinProof | null> {
  try {
    return decodeProof((await cookies()).get(JOIN_PROOF_COOKIE)?.value)
  } catch {
    return null
  }
}

/** A proof that has passed the code check — what every gated route asks for. */
export async function readVerifiedProof(): Promise<JoinProof | null> {
  const p = await readProof()
  return p?.stage === 'verified' ? p : null
}

export async function writeProof(
  target: ProofTarget,
  stage: JoinProof['stage'],
  phone?: string,
): Promise<boolean> {
  const proof: JoinProof = {
    v: 1,
    target,
    phone,
    stage,
    verifiedAt: stage === 'verified' ? new Date().toISOString() : undefined,
    exp: Date.now() + (stage === 'verified' ? VERIFIED_TTL_MS : SENT_TTL_MS),
  }
  const value = encodeProof(proof)
  if (!value) return false
  ;(await cookies()).set(JOIN_PROOF_COOKIE, value, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: Math.floor((proof.exp - Date.now()) / 1000),
  })
  return true
}

export async function clearProof(): Promise<void> {
  try {
    ;(await cookies()).delete(JOIN_PROOF_COOKIE)
  } catch {
    /* nothing to clear */
  }
}

/**
 * A Google listing number as something an SMS can be sent to.
 *
 * Prefers Google's international format ("+1 415-487-2600"). The national one
 * ("(415) 487-2600") carries no country, so it is only trusted for the one case
 * that is unambiguous: ten digits, North America. Anything else returns null —
 * texting a guessed country is how a code reaches a stranger.
 */
export function toE164(intl: string | null | undefined, national?: string | null): string | null {
  if (intl && intl.trim().startsWith('+')) {
    const d = intl.replace(/\D/g, '')
    if (d.length >= 8 && d.length <= 15) return `+${d}`
  }
  const d = String(national ?? '').replace(/\D/g, '')
  if (d.length === 10) return `+1${d}`
  if (d.length === 11 && d.startsWith('1')) return `+${d}`
  return null
}

/**
 * The number an existing page's ownership code goes to, in the same priority
 * the connector used: admin-set trusted number → owner number → the listing's
 * business number → whatever Google lists for its place. Never a number the
 * client typed.
 */
export async function resolveOwnershipPhone(profile: Record<string, unknown>): Promise<string | null> {
  const str = (v: unknown) => (typeof v === 'string' ? v : null)
  for (const candidate of [profile.trustedPhone, profile.ownerPhone, profile.businessPhone]) {
    const e = toE164(str(candidate), str(candidate))
    if (e) return e
  }
  // Every page we create from a listing stores "…?q=place_id:<id>".
  const placeId = str(profile.googleMapsUrl)?.match(/place_id[:=]([A-Za-z0-9_-]+)/)?.[1]
  if (placeId) {
    const d = await placeDetails(placeId)
    if (d) return toE164(d.internationalPhone, d.phone)
  }
  return null
}

export function maskPhone(e164: string): string {
  const d = e164.replace(/\D/g, '')
  return d.length >= 4 ? `(•••) •••-${d.slice(-4)}` : '•••'
}
