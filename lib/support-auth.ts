import { timingSafeEqual } from 'crypto'
import { auth } from '@clerk/nextjs/server'
import { isAdmin } from '@/lib/admin'

// Who may use the STAFF side of support chat: a super-admin's Clerk session, or
// Feedbase's Messages tab calling server-to-server with `x-support-secret`.
// The secret only ever lives in two server envs (this app's SUPPORT_API_SECRET
// and Feedbase's Convex deployment) — never in a browser bundle. Unset = off:
// no secret configured means the header is ignored and only admins get in.

export type Staff = { via: 'admin'; userId: string } | { via: 'secret' }

export function hasSupportSecret(req: Request): boolean {
  const secret = process.env.SUPPORT_API_SECRET
  const given = req.headers.get('x-support-secret')
  if (!secret || !given) return false
  const a = Buffer.from(secret)
  const b = Buffer.from(given)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function supportStaff(req: Request): Promise<Staff | null> {
  if (hasSupportSecret(req)) return { via: 'secret' }
  const { userId } = await auth()
  return userId && isAdmin(userId) ? { via: 'admin', userId } : null
}
