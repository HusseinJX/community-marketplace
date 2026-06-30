import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Free RSVP / attendees data layer for organizer events.
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

export type RsvpStatus = 'going' | 'cancelled'

export interface Attendee {
  id: string
  event_id: string
  attendee_id: string
  attendee_name: string | null
  attendee_contact: string | null
  party_size: number
  status: RsvpStatus
  created_at: string
}

// Sum of party sizes for everyone going (the real headcount).
export async function getGoingCount(eventId: string): Promise<number> {
  const { data, error } = await db()
    .from('event_attendees')
    .select('party_size')
    .eq('event_id', eventId)
    .eq('status', 'going')
  if (error || !data) return 0
  return data.reduce((sum, r) => sum + (r.party_size || 1), 0)
}

export async function getMyRsvp(eventId: string, attendeeId: string): Promise<Attendee | null> {
  const { data } = await db()
    .from('event_attendees')
    .select('*')
    .eq('event_id', eventId)
    .eq('attendee_id', attendeeId)
    .maybeSingle()
  return (data as Attendee) ?? null
}

export async function getAttendees(eventId: string): Promise<Attendee[]> {
  const { data, error } = await db()
    .from('event_attendees')
    .select('*')
    .eq('event_id', eventId)
    .eq('status', 'going')
    .order('created_at', { ascending: true })
  if (error || !data) return []
  return data as Attendee[]
}

export async function rsvp(
  eventId: string,
  attendee: { attendee_id: string; attendee_name?: string | null; attendee_contact?: string | null; party_size?: number }
): Promise<Attendee> {
  const row = {
    event_id: eventId,
    attendee_id: attendee.attendee_id,
    attendee_name: attendee.attendee_name ?? null,
    attendee_contact: attendee.attendee_contact ?? null,
    party_size: Math.max(1, Math.min(attendee.party_size || 1, 20)),
    status: 'going' as const,
    updated_at: new Date().toISOString(),
  }
  const { data, error } = await db()
    .from('event_attendees')
    .upsert(row, { onConflict: 'event_id,attendee_id' })
    .select()
    .single()
  if (error || !data) throw new Error(`Failed to RSVP: ${error?.message}`)
  return data as Attendee
}

export async function cancelRsvp(eventId: string, attendeeId: string): Promise<void> {
  const { error } = await db()
    .from('event_attendees')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('event_id', eventId)
    .eq('attendee_id', attendeeId)
  if (error) throw new Error(`Failed to cancel RSVP: ${error.message}`)
}
