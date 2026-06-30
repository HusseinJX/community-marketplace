import { auth } from '@clerk/nextjs/server'
import { getVendorProfile } from './vendor-connect'
import { isDemoMode } from './demo-admin'
import { demoMemberId } from './demo-server'

// Comma-separated Clerk user IDs allowed to act on behalf of any business.
export function adminUserIds(): string[] {
  return (process.env.ADMIN_CLERK_USER_IDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

export function isAdmin(userId: string | null | undefined): boolean {
  return !!userId && adminUserIds().includes(userId)
}

export interface Actor {
  userId: string
  memberId: string
  isAdmin: boolean
  // True when resolved via demo mode (no Clerk user). Writes should no-op.
  isDemo?: boolean
}

// Resolve which member_id the current Clerk user may act on for a write.
// - Admins may target any `requestedMemberId`.
// - Otherwise the user acts on their own linked member (vendor_profiles).
// Returns null when unauthorized.
export async function resolveActor(requestedMemberId?: string | null): Promise<Actor | null> {
  const { userId } = await auth()
  if (!userId) {
    // Demo mode: no Clerk user, but resolve a representative demo member so the
    // admin UIs (collab network, etc.) populate. Flagged isDemo so writes no-op.
    if (isDemoMode()) {
      const memberId = requestedMemberId || (await demoMemberId())
      if (memberId) return { userId: 'demo', memberId, isAdmin: false, isDemo: true }
    }
    return null
  }

  const admin = isAdmin(userId)
  if (admin && requestedMemberId) {
    return { userId, memberId: requestedMemberId, isAdmin: true }
  }

  const profile = await getVendorProfile(userId)
  if (!profile) return null

  // A non-admin cannot act on someone else's member.
  if (requestedMemberId && requestedMemberId !== profile.member_id && !admin) {
    return null
  }
  return { userId, memberId: profile.member_id, isAdmin: admin }
}
