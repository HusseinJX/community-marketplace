import { cookies } from 'next/headers'
import { DEMO_COOKIE, isDemoType, isDemoMode } from './demo-admin'

// Is this request a demo preview? True when the global env flag is on, OR when
// the visitor explicitly entered the demo via /demo (which sets a demo-type
// cookie). The cookie path lets the "Admin demo" work without sign-in even in
// production, where the global flag stays off. Only ever consulted for
// signed-out requests, and demo writes still no-op — so real vendors are
// unaffected and no real data is mutated.
export async function isDemoActive(): Promise<boolean> {
  if (isDemoMode()) return true
  const c = (await cookies()).get(DEMO_COOKIE)?.value
  return isDemoType(c)
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
