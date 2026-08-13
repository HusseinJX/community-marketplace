import 'server-only'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Saved ("bookmarked") businesses — a private list, one row per person per
// business. The sibling of lib/saved-events.ts; see the 20260813120000
// migration for why member_id is text and why this is its own table.

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

/** Every business this user has saved, newest save first. */
export async function getSavedMemberIds(userId: string): Promise<string[]> {
  const { data, error } = await db()
    .from('saved_members')
    .select('member_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(500)
  if (error || !data) return []
  return (data as { member_id: string }[]).map((r) => r.member_id)
}

/** Idempotent — saving twice is not an error, it's the same bookmark. */
export async function saveMember(userId: string, memberId: string): Promise<void> {
  const { error } = await db()
    .from('saved_members')
    .upsert({ user_id: userId, member_id: memberId }, { onConflict: 'user_id,member_id' })
  if (error) throw new Error(`Failed to save business: ${error.message}`)
}

export async function unsaveMember(userId: string, memberId: string): Promise<void> {
  const { error } = await db()
    .from('saved_members')
    .delete()
    .eq('user_id', userId)
    .eq('member_id', memberId)
  if (error) throw new Error(`Failed to unsave business: ${error.message}`)
}
