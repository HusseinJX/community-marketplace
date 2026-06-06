import { auth } from '@clerk/nextjs/server'
import { getVendorProfile } from './vendor-connect'

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
}

// Resolve which member_id the current Clerk user may act on for a write.
// - Admins may target any `requestedMemberId`.
// - Otherwise the user acts on their own linked member (vendor_profiles).
// Returns null when unauthorized.
export async function resolveActor(requestedMemberId?: string | null): Promise<Actor | null> {
  const { userId } = await auth()
  if (!userId) return null

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
