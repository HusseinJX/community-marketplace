import { NextResponse } from 'next/server'
import { supportStaff } from '@/lib/support-auth'
import { listThreads } from '@/lib/support'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// The STAFF inbox. Super-admins only — this reads everyone's conversation with
// us, so the gate is the same one that guards /vendor/admin itself — plus
// Feedbase's Messages tab via the shared secret (lib/support-auth).
export async function GET(req: Request) {
  if (!(await supportStaff(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  return NextResponse.json({ threads: await listThreads() })
}
