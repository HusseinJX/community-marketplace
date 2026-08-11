import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { isAdmin } from '@/lib/admin'
import {
  listReports,
  removePost,
  restorePost,
  banAuthor,
  purgePost,
  listModerationEvents,
  clearHeldPost,
  upholdHeldPost,
  resolveModerationEvent,
  getPostsForModeration,
} from '@/lib/moderation'
import { deleteVideosSafe } from '@/lib/youtube'

// Moderator queue (App Store 1.2 — "act on reports within 24h"). isAdmin-gated.
// GET lists pending human reports AND what the AI screener stopped; POST acts
// on either. The two queues stay separate in the response: a report is a person
// objecting, a screening event is a model guessing, and they deserve different
// levels of trust from whoever is working the queue.
export async function GET() {
  const { userId } = await auth()
  if (!isAdmin(userId)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const [reports, screened] = await Promise.all([listReports('pending'), listModerationEvents('pending')])
  // Join held posts back to their content so the queue can show the actual
  // photo — a blocked write has no post to fetch, and neither does a chat.
  const posts = await getPostsForModeration(
    screened.filter((e) => e.surface === 'post' && e.content_id).map((e) => e.content_id as string),
  )
  return NextResponse.json({
    reports,
    screened: screened.map((e) => ({ ...e, post: e.content_id ? (posts[e.content_id] ?? null) : null })),
  })
}

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!isAdmin(userId)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const b = (await req.json().catch(() => ({}))) as {
    action?: 'remove' | 'restore' | 'ban' | 'purge' | 'clear' | 'uphold' | 'resolve'
    postId?: string
    authorId?: string
    reason?: string
    eventId?: string
    status?: 'actioned' | 'dismissed'
  }
  try {
    // `clear` / `uphold` are the AI queue's verdicts on a HELD post (one the
    // screener hid pre-emptively). `resolve` closes an event with no post to
    // act on — a blocked write that was never inserted, or a chat message.
    if (b.action === 'clear' && b.postId) await clearHeldPost(b.postId)
    else if (b.action === 'uphold' && b.postId) await upholdHeldPost(b.postId)
    else if (b.action === 'resolve' && b.eventId) {
      await resolveModerationEvent(b.eventId, b.status === 'actioned' ? 'actioned' : 'dismissed')
    }
    else if (b.action === 'remove' && b.postId) await removePost(b.postId)
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
