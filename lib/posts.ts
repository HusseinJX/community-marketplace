import { createClient, SupabaseClient } from '@supabase/supabase-js'

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
  created_at: string
}

export type NewPost = Omit<Post, 'id' | 'created_at'>

export async function createPost(p: NewPost): Promise<Post> {
  const { data, error } = await db().from('posts').insert(p).select().single()
  if (error || !data) throw new Error(`Failed to create post: ${error?.message}`)
  return data as Post
}

export async function getPosts(limit = 50): Promise<Post[]> {
  const { data, error } = await db()
    .from('posts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error || !data) return []
  return data as Post[]
}
