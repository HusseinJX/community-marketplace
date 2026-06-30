// Demo fixtures for the collaborator network. Used only in demo mode so the
// /vendor/network UI populates without Clerk auth or real DB rows.
// Model: one collaboration = one occasion = one chat room. It's a 1:1 when a
// single collaborator accepted, and a group once 2+ accepted.
import type { CollabInvite, CollabRoom, RoomMember, CollabMessage, CollaborationSummary } from './collab-network'

export const DEMO_ROOM_GROUP = 'demo-room-group' // collab "Sat farmers-market booth" (group, owned)
export const DEMO_ROOM_HOLIDAY = 'demo-room-holiday' // collab "Holiday night market" (1:1, owned)
export const DEMO_ROOM_JOINED = 'demo-room-joined' // collab "Downtown art walk" (we were invited)

const DEMO_ROOM_IDS = new Set([DEMO_ROOM_GROUP, DEMO_ROOM_HOLIDAY, DEMO_ROOM_JOINED])

const T0 = '2026-06-27T18:00:00.000Z'
const T1 = '2026-06-27T18:02:00.000Z'
const T2 = '2026-06-27T18:05:00.000Z'

const OCC_MARKET = 'demo-occasion-market'
const OCC_HOLIDAY = 'demo-occasion-holiday'
const OCC_ARTWALK = 'demo-occasion-artwalk'
const ARTWALK_HOST = 'demo-collab-artwalk'

export function isDemoRoomId(id: string): boolean {
  return DEMO_ROOM_IDS.has(id)
}

export function demoInvites(memberId: string): { incoming: CollabInvite[]; outgoing: CollabInvite[] } {
  const base = {
    scope_type: 'collab' as const,
    scope_id: null,
    role: null as string | null,
    room_id: null as string | null,
    occasion_id: null as string | null,
    occasion_label: null as string | null,
    created_at: T0,
  }
  // Collaboration invites are group invites pointed at the collaboration's room.
  const mk = (
    id: string,
    toId: string,
    toName: string,
    status: CollabInvite['status'],
    occ: string,
    label: string,
    room: string,
    role: string
  ): CollabInvite => ({ ...base, id, from_id: memberId, from_name: 'You', to_id: toId, to_name: toName, message: `Collaborate on "${label}"`, status, role, occasion_id: occ, occasion_label: label, room_id: room })

  return {
    incoming: [
      {
        ...base,
        id: 'demo-invite-in-1',
        from_id: 'demo-collab-bloom',
        from_name: 'Bloom & Branch Florals',
        to_id: memberId,
        to_name: 'You',
        message: 'Want to co-host a spring market booth?',
        status: 'pending',
      },
    ],
    outgoing: [
      mk('demo-occ-1', 'demo-collab-bloom', 'Bloom & Branch Florals', 'accepted', OCC_MARKET, 'Sat farmers-market booth', DEMO_ROOM_GROUP, 'vendor'),
      mk('demo-occ-2', 'demo-collab-mission', 'Mission Coffee Co.', 'accepted', OCC_MARKET, 'Sat farmers-market booth', DEMO_ROOM_GROUP, 'food'),
      mk('demo-occ-3', 'demo-collab-luz', 'Luz Ceramics', 'pending', OCC_MARKET, 'Sat farmers-market booth', DEMO_ROOM_GROUP, 'vendor'),
      mk('demo-hol-1', 'demo-collab-dani', 'Dani Cruz', 'accepted', OCC_HOLIDAY, 'Holiday night market', DEMO_ROOM_HOLIDAY, 'performer'),
      mk('demo-hol-2', 'demo-collab-sol', 'Sol Bakery', 'pending', OCC_HOLIDAY, 'Holiday night market', DEMO_ROOM_HOLIDAY, 'food'),
    ],
  }
}

export function demoRooms(memberId: string): CollabRoom[] {
  return [
    {
      id: DEMO_ROOM_GROUP,
      member_a: memberId,
      member_a_name: 'You',
      member_b: memberId,
      member_b_name: 'You',
      is_group: true,
      title: 'Sat farmers-market booth',
      owner_id: memberId,
      occasion_id: OCC_MARKET,
      occasion_label: 'Sat farmers-market booth',
      event_id: 'demo-event-market',
      created_at: T0,
    },
    {
      id: DEMO_ROOM_HOLIDAY,
      member_a: memberId,
      member_a_name: 'You',
      member_b: memberId,
      member_b_name: 'You',
      is_group: true, // a collaboration room; displays as 1:1 while only 1 accepted
      title: 'Holiday night market',
      owner_id: memberId,
      occasion_id: OCC_HOLIDAY,
      occasion_label: 'Holiday night market',
      created_at: T0,
    },
    {
      // A collaboration someone else owns — we were invited in.
      id: DEMO_ROOM_JOINED,
      member_a: ARTWALK_HOST,
      member_a_name: 'Art Walk Collective',
      member_b: ARTWALK_HOST,
      member_b_name: 'Art Walk Collective',
      is_group: true,
      title: 'Downtown art walk',
      owner_id: ARTWALK_HOST,
      occasion_id: OCC_ARTWALK,
      occasion_label: 'Downtown art walk',
      created_at: T0,
    },
  ]
}

// Process-local demo state so toggling "I'm in" and sending messages stick.
const demoAgreed = new Map<string, boolean>()
const demoSentMessages = new Map<string, CollabMessage[]>()

export function setDemoAgreed(roomId: string, memberId: string, agreed: boolean): void {
  demoAgreed.set(`${roomId}:${memberId}`, agreed)
}

export function addDemoMessage(roomId: string, memberId: string, text: string): CollabMessage {
  const msg: CollabMessage = {
    id: `demo-sent-${(demoSentMessages.get(roomId)?.length ?? 0) + 1}`,
    room_id: roomId,
    sender_id: memberId,
    sender_name: 'You',
    text,
    created_at: new Date().toISOString(),
  }
  demoSentMessages.set(roomId, [...(demoSentMessages.get(roomId) ?? []), msg])
  return msg
}

export function demoRoomMembers(roomId: string, memberId: string): RoomMember[] {
  const youAgreed = demoAgreed.get(`${roomId}:${memberId}`) ?? false
  const you: RoomMember = { id: `${roomId}-you`, room_id: roomId, member_id: memberId, member_name: 'You', agreed: youAgreed, created_at: T0 }
  if (roomId === DEMO_ROOM_GROUP) {
    return [
      you,
      { id: 'demo-rm-bloom', room_id: roomId, member_id: 'demo-collab-bloom', member_name: 'Bloom & Branch Florals', agreed: true, created_at: T0 },
      { id: 'demo-rm-mission', room_id: roomId, member_id: 'demo-collab-mission', member_name: 'Mission Coffee Co.', agreed: true, created_at: T0 },
    ]
  }
  if (roomId === DEMO_ROOM_HOLIDAY) {
    return [you, { id: 'demo-rm-dani', room_id: roomId, member_id: 'demo-collab-dani', member_name: 'Dani Cruz', agreed: true, created_at: T0 }]
  }
  if (roomId === DEMO_ROOM_JOINED) {
    // The host owns it; we're just a member.
    return [
      { id: 'demo-rm-host', room_id: roomId, member_id: ARTWALK_HOST, member_name: 'Art Walk Collective', agreed: true, created_at: T0 },
      you,
      { id: 'demo-rm-bloom2', room_id: roomId, member_id: 'demo-collab-bloom', member_name: 'Bloom & Branch Florals', agreed: true, created_at: T0 },
    ]
  }
  return []
}

export function demoMessages(roomId: string, memberId: string): CollabMessage[] {
  let seed: CollabMessage[] = []
  if (roomId === DEMO_ROOM_GROUP) {
    seed = [
      { id: 'demo-gmsg-1', room_id: roomId, sender_id: memberId, sender_name: 'You', text: 'Welcome everyone! Let’s lock in the Saturday market plan.', created_at: T0 },
      { id: 'demo-gmsg-2', room_id: roomId, sender_id: 'demo-collab-bloom', sender_name: 'Bloom & Branch Florals', text: 'In! I can do a floral arch at the entrance.', created_at: T1 },
      { id: 'demo-gmsg-3', room_id: roomId, sender_id: 'demo-collab-mission', sender_name: 'Mission Coffee Co.', text: 'Count us in — espresso cart ready ☕', created_at: T2 },
    ]
  } else if (roomId === DEMO_ROOM_HOLIDAY) {
    seed = [
      { id: 'demo-hmsg-1', room_id: roomId, sender_id: memberId, sender_name: 'You', text: 'Want to do a set at the holiday night market?', created_at: T0 },
      { id: 'demo-hmsg-2', room_id: roomId, sender_id: 'demo-collab-dani', sender_name: 'Dani Cruz', text: "I'm in! What time slot were you thinking?", created_at: T1 },
    ]
  } else if (roomId === DEMO_ROOM_JOINED) {
    seed = [
      { id: 'demo-jmsg-1', room_id: roomId, sender_id: ARTWALK_HOST, sender_name: 'Art Walk Collective', text: 'Thanks for joining the art walk! Setup is 5pm on Valencia.', created_at: T0 },
      { id: 'demo-jmsg-2', room_id: roomId, sender_id: memberId, sender_name: 'You', text: 'Excited — we’ll bring our booth.', created_at: T1 },
    ]
  } else {
    return []
  }
  return [...seed, ...(demoSentMessages.get(roomId) ?? [])]
}

export function demoCollaborations(memberId: string): CollaborationSummary[] {
  void memberId
  return [
    {
      occasion_id: OCC_MARKET,
      label: 'Sat farmers-market booth',
      roomId: DEMO_ROOM_GROUP,
      eventId: 'demo-event-market',
      owned: true,
      acceptedCount: 2, // group
      members: [
        { invite_id: 'demo-occ-1', to_id: 'demo-collab-bloom', to_name: 'Bloom & Branch Florals', status: 'accepted', role: 'vendor' },
        { invite_id: 'demo-occ-2', to_id: 'demo-collab-mission', to_name: 'Mission Coffee Co.', status: 'accepted', role: 'food' },
        { invite_id: 'demo-occ-3', to_id: 'demo-collab-luz', to_name: 'Luz Ceramics', status: 'pending', role: 'vendor' },
      ],
    },
    {
      occasion_id: OCC_HOLIDAY,
      label: 'Holiday night market',
      roomId: DEMO_ROOM_HOLIDAY,
      eventId: null,
      owned: true,
      acceptedCount: 1, // 1:1
      members: [
        { invite_id: 'demo-hol-1', to_id: 'demo-collab-dani', to_name: 'Dani Cruz', status: 'accepted', role: 'performer' },
        { invite_id: 'demo-hol-2', to_id: 'demo-collab-sol', to_name: 'Sol Bakery', status: 'pending', role: 'food' },
      ],
    },
    {
      // We were invited into this one — no invite/manage controls.
      occasion_id: OCC_ARTWALK,
      label: 'Downtown art walk',
      roomId: DEMO_ROOM_JOINED,
      eventId: null,
      owned: false,
      acceptedCount: 2, // group (host + 2 incl. us)
      members: [],
    },
  ]
}
