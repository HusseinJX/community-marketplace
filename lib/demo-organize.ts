// Demo fixtures for the organizer toolkit (/vendor/organize): events + lineup +
// thread + attendees + join requests. Used only in demo mode so the Organize UI
// is explorable without a real event in the DB. Writes no-op in demo.
import type { VendorEvent } from './vendor-connect'
import type { CollabInvite } from './collab-network'
import type { EventMessage } from './event-comms'
import type { Attendee } from './attendees'
import type { JoinRequest } from './event-join'

export const DEMO_EVENT_MARKET = 'demo-event-market'
export const DEMO_EVENT_WATCH = 'demo-event-watch'

const DEMO_EVENT_IDS = new Set([DEMO_EVENT_MARKET, DEMO_EVENT_WATCH])
export function isDemoEventId(id: string): boolean {
  return DEMO_EVENT_IDS.has(id)
}

const T0 = '2026-06-27T18:00:00.000Z'
const T1 = '2026-06-27T18:04:00.000Z'
const T2 = '2026-06-27T18:09:00.000Z'

export function demoEvents(memberId: string): VendorEvent[] {
  const memberName = 'Your business'
  const baseEvent = {
    member_id: memberId,
    member_name: memberName,
    description: null as string | null,
    city: 'San Francisco',
    neighborhood: 'Mission',
    poster_image_url: null as string | null,
    source: 'manual',
    created_at: T0,
  }
  return [
    {
      ...baseEvent,
      id: DEMO_EVENT_MARKET,
      title: 'Saturday Market Pop-up',
      event_date: 'Sat, Jul 11',
      event_time: '10:00 AM',
      location: 'Dolores Park',
      lat: 37.7596,
      lng: -122.4269,
      capacity: 200,
      active: true,
    },
    {
      ...baseEvent,
      id: DEMO_EVENT_WATCH,
      title: 'World Cup Watch Party',
      event_date: 'Sun, Jul 12',
      event_time: '12:00 PM',
      location: 'Courtside Sports Bar',
      lat: 37.7621,
      lng: -122.4358,
      capacity: null,
      active: false, // draft
    },
  ]
}

// Lineup = event-scoped invites with a role + status.
export function demoLineup(eventId: string, memberId: string): CollabInvite[] {
  if (eventId !== DEMO_EVENT_MARKET) return []
  const base = {
    from_id: memberId,
    from_name: 'Your business',
    message: 'Join the lineup for Saturday Market Pop-up',
    scope_type: 'event' as const,
    scope_id: eventId,
    room_id: null,
    occasion_id: null,
    occasion_label: null,
    created_at: T0,
  }
  return [
    { ...base, id: 'demo-lu-1', to_id: 'demo-collab-bloom', to_name: 'Bloom & Branch Florals', role: 'vendor', status: 'accepted' },
    { ...base, id: 'demo-lu-2', to_id: 'demo-collab-mission', to_name: 'Mission Coffee Co.', role: 'food', status: 'accepted' },
    { ...base, id: 'demo-lu-3', to_id: 'demo-collab-sol', to_name: 'Sol Bakery', role: 'food', status: 'pending' },
    { ...base, id: 'demo-lu-4', to_id: 'demo-collab-luz', to_name: 'Luz Ceramics', role: 'vendor', status: 'pending' },
    { ...base, id: 'demo-lu-5', to_id: 'demo-collab-dani', to_name: 'Dani Cruz (DJ)', role: 'performer', status: 'accepted' },
  ]
}

export function demoEventMessages(eventId: string, memberId: string): EventMessage[] {
  if (eventId !== DEMO_EVENT_MARKET) return []
  return [
    { id: 'demo-em-1', event_id: eventId, sender_id: memberId, sender_name: 'You', text: 'Hi all — load-in is 8:30am, booths face the path. Bring your own table!', channel: 'chat', recipients: null, created_at: T0 },
    { id: 'demo-em-2', event_id: eventId, sender_id: 'demo-collab-bloom', sender_name: 'Bloom & Branch Florals', text: 'Got it — we’ll be there by 8.', channel: 'chat', recipients: null, created_at: T1 },
    { id: 'demo-em-3', event_id: eventId, sender_id: memberId, sender_name: 'You', text: 'Reminder: market starts at 10am sharp ☀️', channel: 'sms', recipients: 3, created_at: T2 },
  ]
}

export function demoAttendees(eventId: string) {
  if (eventId !== DEMO_EVENT_MARKET) return { count: 0, capacity: null as number | null, attendees: [] as Attendee[] }
  const attendees: Attendee[] = [
    { id: 'demo-at-1', event_id: eventId, attendee_id: 'u1', attendee_name: 'Maria G.', attendee_contact: 'maria@example.com', party_size: 2, status: 'going', created_at: T0 },
    { id: 'demo-at-2', event_id: eventId, attendee_id: 'u2', attendee_name: 'Devin R.', attendee_contact: null, party_size: 1, status: 'going', created_at: T1 },
    { id: 'demo-at-3', event_id: eventId, attendee_id: 'u3', attendee_name: 'The Patel family', attendee_contact: '+1 415 555 0143', party_size: 4, status: 'going', created_at: T2 },
  ]
  const count = attendees.reduce((n, a) => n + a.party_size, 0)
  return { count, capacity: 200 as number | null, attendees }
}

export function demoJoinRequests(eventId: string): JoinRequest[] {
  if (eventId !== DEMO_EVENT_MARKET) return []
  return [
    { id: 'demo-jr-1', event_id: eventId, name: 'Taqueria El Sol', category: 'Food', contact: 'hola@elsol.example', note: 'We make tacos and aguas frescas — would love a booth!', status: 'pending', created_at: T0 },
  ]
}
