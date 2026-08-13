import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getSavedMemberIds, saveMember, unsaveMember } from '@/lib/saved-members'

// The bookmark on a business card. GET returns the whole id list in one
// request rather than a per-card lookup — the Shops tab renders ~80 cards, and
// 80 round trips to answer "is this saved?" is 80 too many. The client holds it
// as a set (see useSavedMembers in lib/data-hooks). Mirrors /api/saved-events.

export async function GET() {
  const { userId } = await auth()
  // Signed out isn't an error here — it's an empty list. The card still renders.
  if (!userId) return NextResponse.json({ memberIds: [] })
  try {
    return NextResponse.json({ memberIds: await getSavedMemberIds(userId) })
  } catch {
    return NextResponse.json({ memberIds: [] })
  }
}

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Sign in to save businesses' }, { status: 401 })
  const { memberId } = (await req.json().catch(() => ({}))) as { memberId?: string }
  if (!memberId) return NextResponse.json({ error: 'memberId required' }, { status: 400 })
  try {
    await saveMember(userId, memberId)
    return NextResponse.json({ saved: true })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Sign in' }, { status: 401 })
  const { memberId } = (await req.json().catch(() => ({}))) as { memberId?: string }
  if (!memberId) return NextResponse.json({ error: 'memberId required' }, { status: 400 })
  try {
    await unsaveMember(userId, memberId)
    return NextResponse.json({ saved: false })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 })
  }
}
