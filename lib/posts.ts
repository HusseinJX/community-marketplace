import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { unstable_cache, revalidateTag } from 'next/cache'
import { getBlockedAuthorIds, getBannedAuthorIds } from '@/lib/moderation'

// "Share" posts data layer. Service-role preferred (falls back to anon, which
// the open grant/policy permits).
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

export interface Post {
  id: string
  author_id: string
  author_name: string | null
  body: string | null
  image_urls: string[]
  video_urls: string[]
  tagged_member_id: string | null
  tagged_member_name: string | null
  tagged_event_id: string | null
  tagged_event_title: string | null
  livestream_url: string | null
  location: string | null
  // Where the post was made. NULL on every row written before 2026-08-05, and
  // on any post whose location tag we couldn't measure — see the migration.
  // A null here must never be treated as "nearby".
  lat: number | null
  lng: number | null
  // AI pre-publish screening verdict: 'allowed' | 'pending' | 'cleared'.
  // 'pending' hides the post everywhere until a human looks — see the
  // 20260811120000_ai_moderation migration for why it is not just `removed`.
  moderation_status?: string
  created_at: string
  // attached by the API layer (not columns on the row)
  reactions?: number
  reacted?: boolean
  /**
   * Everyone tagged in this post, from post_member_tags — several artists on
   * one mural. Absent on posts with no multi-tag, where `tagged_member_id` is
   * still the whole answer.
   */
  tags?: { id: string; name: string | null }[]
}

export type NewPost = Omit<Post, 'id' | 'created_at' | 'reactions' | 'reacted'>

/**
 * ── What is cached here, and what deliberately is not ──────────────────────
 *
 * GET /api/posts was four Supabase round-trips on every single request and
 * measured 430–720ms at the origin, for a feed that changes when someone
 * posts — a few times a day. But it cannot be cached whole: two parts of the
 * answer belong to the viewer (who they have blocked, which posts they have
 * hearted), and caching those would show one person's feed to another.
 *
 * So the split is by OWNERSHIP, not by cost:
 *   cached   — the post rows, the banned-author list, the raw reaction rows
 *              (identical for everyone, tagged so a write clears them)
 *   per-view — blocked authors, and the `reacted` flag, both computed from
 *              the cached rows without another query
 *
 * The tags matter more than the TTL: a 30s window on your own post not
 * appearing after you publish it is not a cache, it is a bug. createPost and
 * toggleReaction clear their tag, so the write path stays immediate and the
 * read path stays cheap.
 */
const TAG_POSTS = 'posts'
const TAG_REACTIONS = 'post-reactions'

const cachedPostRows = unstable_cache(
  async (scope: 'all' | 'member' | 'event', id: string | null, limit: number) => {
    let q = db().from('posts').select('*').eq('removed', false).neq('moderation_status', 'pending')
    if (scope === 'member' && id) {
      // A member can be tagged in two places: the original single column, and
      // post_member_tags for posts with several people in them. Union, or a
      // mural shows up for its first artist and nobody else.
      const { data: tagged } = await db()
        .from('post_member_tags')
        .select('post_id')
        .eq('member_id', id)
        .order('created_at', { ascending: false })
        .limit(limit)
      const ids = ((tagged as { post_id: string }[]) ?? []).map((t) => t.post_id)
      q = ids.length
        ? q.or(`tagged_member_id.eq.${id},id.in.(${ids.join(',')})`)
        : q.eq('tagged_member_id', id)
    }
    if (scope === 'event' && id) q = q.eq('tagged_event_id', id)
    const { data, error } = await q.order('created_at', { ascending: false }).limit(limit)
    if (error || !data) return [] as Post[]
    return data as Post[]
  },
  ['posts-rows'],
  { tags: [TAG_POSTS], revalidate: 60 },
)

/** Bans change the feed for everyone, so they ride the same tag as the posts. */
const cachedBannedIds = unstable_cache(
  async () => Array.from(await getBannedAuthorIds()),
  ['banned-author-ids'],
  { tags: [TAG_POSTS], revalidate: 60 },
)

const cachedReactionRows = unstable_cache(
  async (postIds: string[]) => {
    if (postIds.length === 0) return [] as { post_id: string; clerk_user_id: string }[]
    const { data } = await db().from('post_reactions').select('post_id, clerk_user_id').in('post_id', postIds)
    return (data as { post_id: string; clerk_user_id: string }[]) ?? []
  },
  ['post-reaction-rows'],
  { tags: [TAG_REACTIONS], revalidate: 60 },
)

/**
 * Clear the read caches after a write.
 *
 * `revalidateTag` and NOT `updateTag`: updateTag is Server-Action-only and
 * throws outright in a route handler, which is the only place these are
 * called from. The 'max' profile is Next 16's spelling of the old one-argument
 * behaviour — purge it, don't hold a stale copy.
 */
export function invalidatePosts() {
  revalidateTag(TAG_POSTS, 'max')
}
export function invalidateReactions() {
  revalidateTag(TAG_REACTIONS, 'max')
}

// Reaction counts (+ whether the viewer reacted) for a set of posts.
export async function getReactionsForPosts(
  postIds: string[],
  userId?: string | null
): Promise<Record<string, { count: number; reacted: boolean }>> {
  const map: Record<string, { count: number; reacted: boolean }> = {}
  for (const id of postIds) map[id] = { count: 0, reacted: false }
  if (postIds.length === 0) return map
  // The rows are shared; only the `reacted` line below reads `userId`, so the
  // query is cached and the personalisation happens on top of it.
  const data = await cachedReactionRows(postIds)
  for (const r of data) {
    const m = map[r.post_id] ?? (map[r.post_id] = { count: 0, reacted: false })
    m.count++
    if (userId && r.clerk_user_id === userId) m.reacted = true
  }
  return map
}

// Toggle the viewer's ❤️ on a post. Returns the new state + total.
export async function toggleReaction(postId: string, userId: string): Promise<{ reacted: boolean; count: number }> {
  const { data: existing } = await db()
    .from('post_reactions')
    .select('id')
    .eq('post_id', postId)
    .eq('clerk_user_id', userId)
    .maybeSingle()
  if (existing) {
    await db().from('post_reactions').delete().eq('id', (existing as { id: string }).id)
  } else {
    await db().from('post_reactions').insert({ post_id: postId, clerk_user_id: userId })
  }
  const { count } = await db()
    .from('post_reactions')
    .select('id', { count: 'exact', head: true })
    .eq('post_id', postId)
  return { reacted: !existing, count: count ?? 0 }
}

export async function createPost(
  p: NewPost,
  /**
   * Everyone else in the post. A mural has several artists and each of them
   * should find it on their own page; `tagged_member_id` can only name one.
   * Pass ALL of them here including the primary — the write is idempotent per
   * (post, member), and leaving the primary out would make it the one tag the
   * union has to special-case.
   */
  alsoTagged?: { id: string; name?: string | null }[],
): Promise<Post> {
  const { data, error } = await db().from('posts').insert(p).select().single()
  if (error || !data) throw new Error(`Failed to create post: ${error?.message}`)
  const post = data as Post

  const tags = (alsoTagged ?? []).filter((t) => t?.id)
  if (tags.length) {
    // Best-effort: the post exists and is already visible. A failed tag write
    // must not throw away a photo somebody just took.
    await db()
      .from('post_member_tags')
      .upsert(
        tags.map((t) => ({ post_id: post.id, member_id: t.id, member_name: t.name ?? null })),
        { onConflict: 'post_id,member_id' },
      )
      .then(undefined, () => undefined)
  }
  return post
}

/**
 * Tags for a page of posts, in ONE query.
 *
 * Batched for the same reason reactions are: a feed of 50 posts asking one at a
 * time is 50 round trips for a handful of rows.
 */
export async function getTagsForPosts(
  postIds: string[],
): Promise<Record<string, { id: string; name: string | null }[]>> {
  if (postIds.length === 0) return {}
  const { data } = await db()
    .from('post_member_tags')
    .select('post_id, member_id, member_name')
    .in('post_id', postIds)
  const out: Record<string, { id: string; name: string | null }[]> = {}
  for (const r of (data as { post_id: string; member_id: string; member_name: string | null }[]) ?? []) {
    ;(out[r.post_id] ??= []).push({ id: r.member_id, name: r.member_name })
  }
  return out
}

/** Everyone tagged in a post, for the chips under it. */
export async function getPostTags(postId: string): Promise<{ id: string; name: string | null }[]> {
  const { data } = await db()
    .from('post_member_tags')
    .select('member_id, member_name')
    .eq('post_id', postId)
  return ((data as { member_id: string; member_name: string | null }[]) ?? []).map((r) => ({
    id: r.member_id,
    name: r.member_name,
  }))
}

// Drop content the viewer should never see (App Store 1.2): globally-removed
// posts and those the AI screener is holding for review are filtered in SQL;
// banned authors + the viewer's blocked users are filtered here (small sets).
// Pass the viewer's clerk_user_id to apply blocks.
async function withoutModerated(posts: Post[], viewerId?: string | null): Promise<Post[]> {
  // Blocked is the viewer's own list and is never cached — one person's block
  // list must not decide what another person sees. Banned is global.
  const [blocked, bannedIds] = await Promise.all([getBlockedAuthorIds(viewerId), cachedBannedIds()])
  const banned = new Set(bannedIds)
  if (blocked.size === 0 && banned.size === 0) return posts
  return posts.filter((p) => !blocked.has(p.author_id) && !banned.has(p.author_id))
}

export async function getPosts(limit = 50, viewerId?: string | null): Promise<Post[]> {
  const rows = await cachedPostRows('all', null, limit)
  return withoutModerated(rows, viewerId)
}

// "Memories" — every post the community tagged to one business.
export async function getPostsByMemberId(memberId: string, limit = 100, viewerId?: string | null): Promise<Post[]> {
  const rows = await cachedPostRows('member', memberId, limit)
  return withoutModerated(rows, viewerId)
}

// "Memories" — every post the community tagged to one event (or live broadcast;
// the share composer stores a scanned broadcast id in tagged_event_id too).
export async function getPostsByEventId(eventId: string, limit = 100, viewerId?: string | null): Promise<Post[]> {
  const rows = await cachedPostRows('event', eventId, limit)
  return withoutModerated(rows, viewerId)
}

/**
 * Hard-delete a post the caller owns, returning the media it referenced so the
 * caller can reap it.
 *
 * Deliberately separate from moderation's removePost(), which is a SOFT hide
 * paired with restorePost() — reaping a moderated post's video would make
 * "restore" impossible. This is the author saying delete, and meaning it.
 *
 * Ownership is enforced in the statement itself (`author_id = ...`) rather than
 * by reading the row and checking in JS: one round trip, and no window between
 * the check and the delete.
 */
export async function deleteOwnPost(
  postId: string,
  authorId: string,
  opts: { admin?: boolean } = {}
): Promise<{ deleted: boolean; videoUrls: string[] }> {
  let q = db().from('posts').delete().eq('id', postId)
  // An admin deletes anyone's; everyone else is scoped to their own rows.
  if (!opts.admin) q = q.eq('author_id', authorId)

  const { data, error } = await q.select('video_urls')

  if (error) throw new Error(`could not delete post: ${error.message}`)
  const row = data?.[0] as { video_urls?: string[] } | undefined
  return { deleted: !!row, videoUrls: row?.video_urls ?? [] }
}
