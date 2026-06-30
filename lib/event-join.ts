import { createClient, SupabaseClient } from '@supabase/supabase-js'

// "Add my business" requests from the event join link (vendors not yet in the
// directory). Creating the actual member happens connector-side.
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

export type JoinRequestStatus = 'pending' | 'added' | 'dismissed'

export interface JoinRequest {
  id: string
  event_id: string
  name: string
  category: string | null
  contact: string | null
  note: string | null
  status: JoinRequestStatus
  created_at: string
}

export async function createJoinRequest(r: {
  event_id: string
  name: string
  category?: string | null
  contact?: string | null
  note?: string | null
}): Promise<JoinRequest> {
  const { data, error } = await db()
    .from('event_join_requests')
    .insert({
      event_id: r.event_id,
      name: r.name,
      category: r.category ?? null,
      contact: r.contact ?? null,
      note: r.note ?? null,
      status: 'pending',
    })
    .select()
    .single()
  if (error || !data) throw new Error(`Failed to submit request: ${error?.message}`)
  return data as JoinRequest
}

export async function getJoinRequests(eventId: string): Promise<JoinRequest[]> {
  const { data, error } = await db()
    .from('event_join_requests')
    .select('*')
    .eq('event_id', eventId)
    .neq('status', 'dismissed')
    .order('created_at', { ascending: false })
  if (error || !data) return []
  return data as JoinRequest[]
}

export async function setJoinRequestStatus(id: string, eventId: string, status: JoinRequestStatus): Promise<void> {
  const { error } = await db()
    .from('event_join_requests')
    .update({ status })
    .eq('id', id)
    .eq('event_id', eventId)
  if (error) throw new Error(`Failed to update request: ${error.message}`)
}
