import { cookies } from 'next/headers'
import { DEMO_COOKIE, isDemoType, isDemoMode } from './demo-admin'

// Is this request a demo preview? DEV/PREVIEW ONLY — true only when the global
// env flag NEXT_PUBLIC_DEMO_MODE=1 is set (local dev / a throwaway preview env).
// In production the vendor portal ALWAYS requires a real Clerk login; no cookie
// can open it. (Previously a password-unlock cookie opened the portal in prod,
// which let a stale cookie stand in for a real session and confused live use.)
export async function isDemoActive(): Promise<boolean> {
  return isDemoMode()
}

// Server-only: in demo mode the vendor pages have no Clerk user → no linked
// member. Resolve a representative demo member (by the demo type cookie) so the
// admin UIs render with sample data instead of the "link your profile" gate.
const DEMO_MEMBER_BY_TYPE: Record<string, string> = {
  vendor: 'demo-courtside-sports-bar',
  artist: 'demo-dani-cruz',
  organizer: 'demo-south-la-mutual-aid',
}

export async function demoMemberId(): Promise<string> {
  const c = (await cookies()).get(DEMO_COOKIE)?.value
  const type = isDemoType(c) ? c : 'vendor'
  return DEMO_MEMBER_BY_TYPE[type] ?? DEMO_MEMBER_BY_TYPE.vendor
}

// The demo member ids above are fabricated, so they have no vectors in the
// connector's matching index — anything semantic seeded from them comes back
// empty. Read-only demo surfaces (the collaborator matcher, opportunities) seed
// from a REAL member instead, so the demo shows real matches.
const DEFAULT_DEMO_SEED = '89516919-256f-4a95-96df-fc9d285f664a' // Xeno (SF)

export async function demoSeedMemberId(): Promise<string> {
  return process.env.DEMO_SEED_MEMBER_ID || DEFAULT_DEMO_SEED
}
