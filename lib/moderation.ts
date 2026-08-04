import 'server-only'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/email'

// UGC moderation (App Store 1.2): report content, block users, and the takedown
// path (remove a post, ban an author). Service-role only — all mutations happen
// in server routes. Feed filtering (lib/posts.ts) reads blocked + banned + the
// per-post `removed` flag so objectionable content disappears immediately.

let client: SupabaseClient | null = null
function db(): SupabaseClient {
  if (!client) {
    const url = process.env.SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
    if (!url || !key) throw new Error('SUPABASE_URL and a Supabase key are required')
    client = createClient(url, key, { auth: { persistSession: false } })
  }
  return client
}

// Apple requires the developer be notified of reports/blocks and act within 24h.
const MOD_EMAIL = process.env.MODERATION_EMAIL || 'hello@whatslocal.ai'
// Reports at or above this count auto-remove the post pending review (a backstop;
// a moderator can also remove immediately).
const AUTO_REMOVE_THRESHOLD = 3

async function notifyDeveloper(subject: string, text: string): Promise<void> {
  try {
    await sendEmail({ to: MOD_EMAIL, subject: `[Moderation] ${subject}`, text })
  } catch {
    /* email is best-effort — the DB row is the durable record */
  }
}

// ── Reads used by feed filtering ────────────────────────────────────────────────

export async function getBlockedAuthorIds(viewerId: string | null | undefined): Promise<Set<string>> {
  if (!viewerId) return new Set()
  const { data } = await db().from('user_blocks').select('blocked_id').eq('blocker_id', viewerId)
  return new Set((data as { blocked_id: string }[] | null)?.map((r) => r.blocked_id) ?? [])
}

export async function getBannedAuthorIds(): Promise<Set<string>> {
  const { data } = await db().from('banned_authors').select('author_id')
  return new Set((data as { author_id: string }[] | null)?.map((r) => r.author_id) ?? [])
}

// ── User actions ────────────────────────────────────────────────────────────────

export async function reportPost(args: {
  postId: string
  reporterId: string
  authorId: string | null
  reason: string
  note?: string | null
}): Promise<void> {
  await db().from('content_reports').insert({
    post_id: args.postId,
    reporter_id: args.reporterId,
    author_id: args.authorId,
    reason: args.reason,
    note: args.note ?? null,
  })

  // Auto-remove once enough distinct reports accumulate (backstop before a human
  // reviews). Counts rows for this post.
  const { count } = await db()
    .from('content_reports')
    .select('id', { count: 'exact', head: true })
    .eq('post_id', args.postId)
  if ((count ?? 0) >= AUTO_REMOVE_THRESHOLD) {
    await db().from('posts').update({ removed: true }).eq('id', args.postId)
  }

  void notifyDeveloper(
    `Post reported (${args.reason})`,
    `Post ${args.postId} reported by ${args.reporterId}. Author: ${args.authorId ?? 'unknown'}. Reason: ${args.reason}. Note: ${args.note ?? '—'}. Reports so far: ${count ?? 1}. Review within 24h at /vendor/admin (Moderation).`,
  )
}

export async function blockUser(blockerId: string, blockedId: string): Promise<void> {
  if (!blockedId || blockerId === blockedId) return
  await db()
    .from('user_blocks')
    .upsert({ blocker_id: blockerId, blocked_id: blockedId }, { onConflict: 'blocker_id,blocked_id' })
  void notifyDeveloper(
    'User blocked',
    `${blockerId} blocked ${blockedId}. If this is abuse, review the author's posts at /vendor/admin (Moderation).`,
  )
}

export async function unblockUser(blockerId: string, blockedId: string): Promise<void> {
  await db().from('user_blocks').delete().eq('blocker_id', blockerId).eq('blocked_id', blockedId)
}

// ── Moderator actions (isAdmin-gated routes) ────────────────────────────────────

export interface ReportRow {
  id: string
  post_id: string
  reporter_id: string
  author_id: string | null
  reason: string
  note: string | null
  status: string
  created_at: string
}

export async function listReports(status = 'pending'): Promise<ReportRow[]> {
  const { data } = await db()
    .from('content_reports')
    .select('*')
    .eq('status', status)
    .order('created_at', { ascending: false })
    .limit(200)
  return (data as ReportRow[]) ?? []
}

export async function removePost(postId: string): Promise<void> {
  await db().from('posts').update({ removed: true }).eq('id', postId)
  await db().from('content_reports').update({ status: 'actioned' }).eq('post_id', postId)
}

export async function restorePost(postId: string): Promise<void> {
  await db().from('posts').update({ removed: false }).eq('id', postId)
  await db().from('content_reports').update({ status: 'dismissed' }).eq('post_id', postId)
}

/** Eject an author: ban them and remove all of their posts. */
export async function banAuthor(authorId: string, reason?: string): Promise<void> {
  if (!authorId) return
  await db().from('banned_authors').upsert({ author_id: authorId, reason: reason ?? null }, { onConflict: 'author_id' })
  await db().from('posts').update({ removed: true }).eq('author_id', authorId)
  await db().from('content_reports').update({ status: 'actioned' }).eq('author_id', authorId)
}

/**
 * Permanently destroy a post and hand back the media it referenced.
 *
 * removePost() is a SOFT hide with restorePost() as its counterpart, which is
 * the right default for a report: a moderator acting on a complaint should be
 * able to be wrong. But a soft hide leaves the video live on the channel — an
 * unlisted YouTube URL is its own access control, so anyone who kept the link
 * keeps watching a post that was "taken down". For content that genuinely has
 * to go, hiding is not enough.
 *
 * So this is the deliberate, irreversible one. It returns the video URLs rather
 * than deleting them here, keeping this module free of a YouTube dependency and
 * letting the caller decide (and report) whether the reap succeeded.
 */
export async function purgePost(postId: string): Promise<{ purged: boolean; videoUrls: string[] }> {
  const { data, error } = await db()
    .from('posts')
    .delete()
    .eq('id', postId)
    .select('video_urls')

  if (error) throw new Error(`could not purge post: ${error.message}`)
  const row = data?.[0] as { video_urls?: string[] } | undefined

  // Close the reports either way: the post is gone, so leaving them pending
  // would keep an unactionable item in the queue forever.
  await db().from('content_reports').update({ status: 'actioned' }).eq('post_id', postId)

  return { purged: !!row, videoUrls: row?.video_urls ?? [] }
}
