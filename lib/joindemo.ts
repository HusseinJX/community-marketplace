import { cookies } from 'next/headers'

// A simple, environment-independent gate for the /joindemo walkthrough. The
// password unlock sets an httpOnly cookie; server routes that the demo needs
// (read-only Google Places, the interview research/voice token) treat that
// cookie as authorization so the demo works anywhere without a real login —
// while the real /join is untouched (it never sets this cookie).

export const JOINDEMO_COOKIE = 'joindemo_ok'

// Shared password gating the demo's billable APIs (Google Places, voice token).
// REQUIRED in production — set JOINDEMO_PASSWORD. Fail-closed: with no env in
// prod there is NO default (a guessable default would leave those APIs open);
// locally it falls back to a dev-only default for convenience.
export const JOINDEMO_PASSWORD: string | null =
  process.env.JOINDEMO_PASSWORD ??
  (process.env.NODE_ENV === 'production' ? null : 'whatslocal')

// Server-side: is the current request inside an unlocked /joindemo session?
export async function isJoinDemoActive(): Promise<boolean> {
  try {
    return (await cookies()).get(JOINDEMO_COOKIE)?.value === '1'
  } catch {
    return false
  }
}
