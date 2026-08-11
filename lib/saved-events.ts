import 'server-only'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Saved ("starred") events — a private bookmark list, one row per person per
// event. See the 20260811130000_saved_events migration for why this is not an
// RSVP and why event_id is text.

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

/** Every event this user has starred, newest save first. */
export async function getSavedEventIds(userId: string): Promise<string[]> {
  const { data, error } = await db()
    .from('saved_events')
    .select('event_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(500)
  if (error || !data) return []
  return (data as { event_id: string }[]).map((r) => r.event_id)
}

/** Idempotent — starring twice is not an error, it's the same star. */
export async function saveEvent(userId: string, eventId: string): Promise<void> {
  const { error } = await db()
    .from('saved_events')
    .upsert({ user_id: userId, event_id: eventId }, { onConflict: 'user_id,event_id' })
  if (error) throw new Error(`Failed to save event: ${error.message}`)
}

export async function unsaveEvent(userId: string, eventId: string): Promise<void> {
  const { error } = await db().from('saved_events').delete().eq('user_id', userId).eq('event_id', eventId)
  if (error) throw new Error(`Failed to unsave event: ${error.message}`)
}
