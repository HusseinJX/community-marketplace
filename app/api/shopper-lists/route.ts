import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import {
  addMemberToList,
  deleteShopperList,
  getShopperLists,
  mergeShopperLists,
  removeMemberFromList,
  upsertShopperList,
} from '@/lib/shopper-lists-server'

// Shopper lists. Mirrors /api/saved-members: the whole set comes back in one
// request, and the client holds it (see useShopperLists in lib/data-hooks).
//
// Signed out is an empty list, not an error — the page still renders, and the
// browser keeps a local draft that gets merged up on sign-in.

export const runtime = 'nodejs'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ lists: [], signedIn: false })
  try {
    return NextResponse.json({ lists: await getShopperLists(userId), signedIn: true })
  } catch {
    return NextResponse.json({ lists: [], signedIn: true })
  }
}

interface Body {
  action?: 'create' | 'add' | 'remove' | 'merge'
  name?: string
  listId?: string
  memberId?: string
  memberIds?: string[]
  lists?: { name: string; memberIds?: string[] }[]
}

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Sign in to keep your lists' }, { status: 401 })

  const body = (await req.json().catch(() => ({}))) as Body
  try {
    switch (body.action) {
      case 'create':
        if (!body.name?.trim()) {
          return NextResponse.json({ error: 'name required' }, { status: 400 })
        }
        return NextResponse.json({
          lists: await upsertShopperList(userId, body.name, body.memberIds ?? []),
        })

      case 'add':
        if (!body.listId || !body.memberId) {
          return NextResponse.json({ error: 'listId and memberId required' }, { status: 400 })
        }
        return NextResponse.json({ lists: await addMemberToList(userId, body.listId, body.memberId) })

      case 'remove':
        if (!body.listId || !body.memberId) {
          return NextResponse.json({ error: 'listId and memberId required' }, { status: 400 })
        }
        return NextResponse.json({
          lists: await removeMemberFromList(userId, body.listId, body.memberId),
        })

      case 'merge':
        if (!Array.isArray(body.lists)) {
          return NextResponse.json({ error: 'lists required' }, { status: 400 })
        }
        return NextResponse.json({ lists: await mergeShopperLists(userId, body.lists) })

      default:
        return NextResponse.json({ error: 'unknown action' }, { status: 400 })
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed' },
      { status: 500 },
    )
  }
}

export async function DELETE(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Sign in' }, { status: 401 })
  const { listId } = (await req.json().catch(() => ({}))) as { listId?: string }
  if (!listId) return NextResponse.json({ error: 'listId required' }, { status: 400 })
  try {
    return NextResponse.json({ lists: await deleteShopperList(userId, listId) })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed' },
      { status: 500 },
    )
  }
}
