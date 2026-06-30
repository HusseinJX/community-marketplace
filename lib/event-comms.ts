import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Event group thread + contact lookup for organizer blasts.
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

export type EventChannel = 'chat' | 'sms' | 'email' | 'announcement'

export interface EventMessage {
  id: string
  event_id: string
  sender_id: string
  sender_name: string | null
  text: string
  channel: EventChannel
  recipients: number | null
  created_at: string
}

export async function getEventMessages(eventId: string): Promise<EventMessage[]> {
  const { data, error } = await db()
    .from('event_messages')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: true })
  if (error || !data) return []
  return data as EventMessage[]
}

export async function postEventMessage(m: {
  event_id: string
  sender_id: string
  sender_name: string | null
  text: string
  channel?: EventChannel
  recipients?: number | null
}): Promise<EventMessage> {
  const { data, error } = await db()
    .from('event_messages')
    .insert({ channel: 'chat', recipients: null, ...m })
    .select()
    .single()
  if (error || !data) throw new Error(`Failed to post message: ${error?.message}`)
  return data as EventMessage
}

export interface MemberContact {
  member_id: string
  email: string | null
  phone: string | null
}

// Best-effort contact gathering for blasts: email from vendor_profiles, phone
// from vendor_settings (the Uber pickup phone is the only normalized phone today).
export async function getMemberContacts(memberIds: string[]): Promise<MemberContact[]> {
  const ids = [...new Set(memberIds)].filter(Boolean)
  if (ids.length === 0) return []

  const [profiles, settings] = await Promise.all([
    db().from('vendor_profiles').select('member_id, email').in('member_id', ids),
    db().from('vendor_settings').select('member_id, uber_pickup_phone').in('member_id', ids),
  ])

  const emailBy = new Map<string, string | null>()
  for (const p of profiles.data ?? []) emailBy.set(p.member_id, p.email ?? null)
  const phoneBy = new Map<string, string | null>()
  for (const s of settings.data ?? []) phoneBy.set(s.member_id, s.uber_pickup_phone ?? null)

  return ids.map((member_id) => ({
    member_id,
    email: emailBy.get(member_id) ?? null,
    phone: phoneBy.get(member_id) ?? null,
  }))
}
