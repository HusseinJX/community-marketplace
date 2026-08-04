// DELETE /api/posts/[id] — the author removes their own post for good.
//
// Distinct from moderation's remove (lib/moderation.ts), which soft-hides a post
// and can be undone by restorePost(). This one is permanent, which is why it
// also reaps the videos: a YouTube URL is its own access control, so an unlisted
// video outlives the row and stays playable forever to anyone holding the link.
// Deleting the row alone would make "delete" a lie.

import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { deleteOwnPost } from '@/lib/posts'
import { deleteVideosSafe } from '@/lib/youtube'
import { isAdmin } from '@/lib/admin'
import { rateLimit } from '@/lib/rate-limit'

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Sign in to delete' }, { status: 401 })

  const limited = rateLimit({ req: request, name: 'post-delete', id: userId, limit: 30, windowMs: 600_000 })
  if (limited) return limited

  const { id } = await params
  if (!id) return NextResponse.json({ error: 'No post given' }, { status: 400 })

  try {
    // An admin may delete anyone's post; everyone else only their own, enforced
    // in the statement rather than by a read-then-check.
    const { deleted, videoUrls } = await deleteOwnPost(id, userId, { admin: isAdmin(userId) })
    if (!deleted) {
      // Already gone, or not theirs. Deliberately the same answer either way —
      // distinguishing them would confirm a stranger's post exists.
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    // The row is already gone, so this cannot fail the request. Awaited rather
    // than fire-and-forget because the caller deserves to know whether the
    // video actually went with it.
    const videosDeleted = await deleteVideosSafe(videoUrls)
    return NextResponse.json({ deleted: true, videosDeleted })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not delete post' },
      { status: 500 }
    )
  }
}
