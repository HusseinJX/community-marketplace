import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { toggleReaction } from '@/lib/posts'

// POST — toggle the signed-in user's ❤️ on a post. Returns { reacted, count }.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Sign in to react' }, { status: 401 })
  try {
    return NextResponse.json(await toggleReaction(id, userId))
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
