import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { isAdmin } from '@/lib/admin'
import { listThreads } from '@/lib/support'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// The STAFF inbox. Super-admins only — this reads everyone's conversation with
// us, so the gate is the same one that guards /vendor/admin itself.
export async function GET() {
  const { userId } = await auth()
  if (!isAdmin(userId)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  return NextResponse.json({ threads: await listThreads() })
}
