import { cookies } from 'next/headers'

// A simple, environment-independent gate for the /joindemo walkthrough. The
// password unlock sets an httpOnly cookie; server routes that the demo needs
// (read-only Google Places, the interview research/voice token) treat that
// cookie as authorization so the demo works anywhere without a real login —
// while the real /join is untouched (it never sets this cookie).

export const JOINDEMO_COOKIE = 'joindemo_ok'

// Simple shared password. Override with the JOINDEMO_PASSWORD env var.
export const JOINDEMO_PASSWORD = process.env.JOINDEMO_PASSWORD || 'whatslocal'

// Server-side: is the current request inside an unlocked /joindemo session?
export async function isJoinDemoActive(): Promise<boolean> {
  try {
    return (await cookies()).get(JOINDEMO_COOKIE)?.value === '1'
  } catch {
    return false
  }
}
