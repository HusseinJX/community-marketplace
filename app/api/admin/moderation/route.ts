import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { isAdmin } from '@/lib/admin'
import { listReports, removePost, restorePost, banAuthor, purgePost } from '@/lib/moderation'
import { deleteVideosSafe } from '@/lib/youtube'

// Moderator queue (App Store 1.2 — "act on reports within 24h"). isAdmin-gated.
// GET lists pending reports; POST removes/restores a post or bans an author.
export async function GET() {
  const { userId } = await auth()
  if (!isAdmin(userId)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  return NextResponse.json({ reports: await listReports('pending') })
}

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!isAdmin(userId)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const b = (await req.json().catch(() => ({}))) as {
    action?: 'remove' | 'restore' | 'ban' | 'purge'
    postId?: string
    authorId?: string
    reason?: string
  }
  try {
    if (b.action === 'remove' && b.postId) await removePost(b.postId)
    else if (b.action === 'restore' && b.postId) await restorePost(b.postId)
    else if (b.action === 'ban' && b.authorId) await banAuthor(b.authorId, b.reason)
    else if (b.action === 'purge' && b.postId) {
      // The irreversible one. `remove` hides a post but leaves its video
      // playable to anyone holding the link, since an unlisted YouTube URL is
      // its own access control — so a real takedown has to reap the media too.
      // Reported separately: the row can be gone while YouTube refused, and a
      // moderator acting on a complaint needs to know which happened.
      const { purged, videoUrls } = await purgePost(b.postId)
      if (!purged) return NextResponse.json({ error: 'not_found' }, { status: 404 })
      const videosDeleted = await deleteVideosSafe(videoUrls)
      return NextResponse.json({ ok: true, videosDeleted, videosFound: videoUrls.length })
    }
    else return NextResponse.json({ error: 'bad_request' }, { status: 400 })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'failed' }, { status: 500 })
  }
}
