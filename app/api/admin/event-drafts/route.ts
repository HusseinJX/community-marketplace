// Review queue for scraped event drafts. Super-admin only.
//
// GET   → the drafts nobody has ruled on yet
// PATCH → { ids: string[], approve: boolean } record a decision
//
// Both decisions are recorded (see lib/sources/review.ts): a rejection has to
// be stamped, or the next sweep re-inserts the same event as a fresh draft.

import { NextResponse, type NextRequest } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { isAdmin } from '@/lib/admin'
import { pendingDrafts, decideDrafts } from '@/lib/sources/review'

export async function GET() {
  const { userId } = await auth()
  if (!isAdmin(userId)) return NextResponse.json({ error: 'Not allowed' }, { status: 403 })

  try {
    return NextResponse.json({ drafts: await pendingDrafts() })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not load drafts' },
      { status: 500 }
    )
  }
}

export async function PATCH(req: NextRequest) {
  const { userId } = await auth()
  if (!isAdmin(userId)) return NextResponse.json({ error: 'Not allowed' }, { status: 403 })

  const body = (await req.json().catch(() => ({}))) as { ids?: unknown; approve?: unknown }
  const ids = Array.isArray(body.ids) ? body.ids.filter((v): v is string => typeof v === 'string') : []
  if (!ids.length) return NextResponse.json({ error: 'No drafts given' }, { status: 400 })
  if (typeof body.approve !== 'boolean') {
    // Defaulting here would mean guessing between publishing and rejecting.
    return NextResponse.json({ error: 'approve must be true or false' }, { status: 400 })
  }

  try {
    const decided = await decideDrafts(ids, body.approve)
    return NextResponse.json({ decided })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not save the decision' },
      { status: 500 }
    )
  }
}
