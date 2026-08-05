import { createClient, SupabaseClient } from '@supabase/supabase-js'
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
  created_at: string
  // attached by the API layer (not columns on the row)
  reactions?: number
  reacted?: boolean
}

export type NewPost = Omit<Post, 'id' | 'created_at' | 'reactions' | 'reacted'>

// Reaction counts (+ whether the viewer reacted) for a set of posts.
export async function getReactionsForPosts(
  postIds: string[],
  userId?: string | null
): Promise<Record<string, { count: number; reacted: boolean }>> {
  const map: Record<string, { count: number; reacted: boolean }> = {}
  for (const id of postIds) map[id] = { count: 0, reacted: false }
  if (postIds.length === 0) return map
  const { data } = await db().from('post_reactions').select('post_id, clerk_user_id').in('post_id', postIds)
  for (const r of (data as { post_id: string; clerk_user_id: string }[]) ?? []) {
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

export async function createPost(p: NewPost): Promise<Post> {
  const { data, error } = await db().from('posts').insert(p).select().single()
  if (error || !data) throw new Error(`Failed to create post: ${error?.message}`)
  return data as Post
}

// Drop content the viewer should never see (App Store 1.2): globally-removed
// posts are filtered in SQL; banned authors + the viewer's blocked users are
// filtered here (small sets). Pass the viewer's clerk_user_id to apply blocks.
async function withoutModerated(posts: Post[], viewerId?: string | null): Promise<Post[]> {
  const [blocked, banned] = await Promise.all([getBlockedAuthorIds(viewerId), getBannedAuthorIds()])
  if (blocked.size === 0 && banned.size === 0) return posts
  return posts.filter((p) => !blocked.has(p.author_id) && !banned.has(p.author_id))
}

export async function getPosts(limit = 50, viewerId?: string | null): Promise<Post[]> {
  const { data, error } = await db()
    .from('posts')
    .select('*')
    .eq('removed', false)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error || !data) return []
  return withoutModerated(data as Post[], viewerId)
}

// "Memories" — every post the community tagged to one business.
export async function getPostsByMemberId(memberId: string, limit = 100, viewerId?: string | null): Promise<Post[]> {
  const { data, error } = await db()
    .from('posts')
    .select('*')
    .eq('tagged_member_id', memberId)
    .eq('removed', false)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error || !data) return []
  return withoutModerated(data as Post[], viewerId)
}

// "Memories" — every post the community tagged to one event (or live broadcast;
// the share composer stores a scanned broadcast id in tagged_event_id too).
export async function getPostsByEventId(eventId: string, limit = 100, viewerId?: string | null): Promise<Post[]> {
  const { data, error } = await db()
    .from('posts')
    .select('*')
    .eq('tagged_event_id', eventId)
    .eq('removed', false)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error || !data) return []
  return withoutModerated(data as Post[], viewerId)
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
