import { cookies } from 'next/headers'
import { DEMO_COOKIE, isDemoType } from './demo-admin'

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
