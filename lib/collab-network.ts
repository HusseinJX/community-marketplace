import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Collaborator network data layer (invites + self-contained rooms).
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

export type InviteStatus = 'pending' | 'accepted' | 'declined'

export interface CollabInvite {
  id: string
  from_id: string
  from_name: string | null
  to_id: string
  to_name: string | null
  message: string | null
  status: InviteStatus
  room_id: string | null
  scope_type: 'collab' | 'event'
  scope_id: string | null
  role: string | null
  // "Outing" grouping: several individual invites for the same occasion share an
  // occasion_id + label so the Sent tab rolls them up (and can promote to a group).
  occasion_id: string | null
  occasion_label: string | null
  created_at: string
}

export interface CollabRoom {
  id: string
  member_a: string
  member_a_name: string | null
  member_b: string
  member_b_name: string | null
  is_group?: boolean
  title?: string | null
  owner_id?: string | null
  occasion_id?: string | null
  occasion_label?: string | null
  event_id?: string | null
  created_at: string
}

export interface RoomMember {
  id: string
  room_id: string
  member_id: string
  member_name: string | null
  agreed: boolean
  created_at: string
}

/** A room member plus where they stand on the event's lineup, once the event
 *  exists. `lineup: null` = not on it (they weren't in when it was created, or
 *  they joined the room afterwards). */
export interface RoomMemberView extends RoomMember {
  lineup: InviteStatus | null
}

// The roster, plus the lineup once the event is made.
//
// Creating the event LOCKS the lineup: it's built from who was "in" at that
// moment (see api/vendor/rooms/[id]/event), and the host has told people a real
// thing is happening with a real list. So after that, `agreed` stops being the
// question — "are you on the lineup" is. Someone who wasn't in can still get on,
// but by asking the host (a pending self-join they approve), not by flipping
// their own switch.
export async function getRoomRoster(
  roomId: string
): Promise<{ members: RoomMemberView[]; eventId: string | null }> {
  const [room, members] = await Promise.all([getRoom(roomId), ensureRoomMembers(roomId)])
  const eventId = room?.event_id ?? null
  if (!eventId) return { members: members.map((m) => ({ ...m, lineup: null })), eventId: null }

  const byMember = new Map<string, InviteStatus>()
  for (const i of await getEventInvites(eventId)) {
    // A member can hold more than one invite row (added at creation, and/or a
    // later self-join). Being on the lineup wins over any pending duplicate.
    if (byMember.get(i.to_id) === 'accepted') continue
    byMember.set(i.to_id, i.status)
  }
  const host = room?.owner_id ?? room?.member_a
  return {
    members: members.map((m) => ({
      ...m,
      // The host isn't on their own lineup as an invite — they ARE the event.
      lineup: m.member_id === host ? 'accepted' : byMember.get(m.member_id) ?? null,
    })),
    eventId,
  }
}

export interface CollabMessage {
  id: string
  room_id: string
  sender_id: string
  sender_name: string | null
  text: string
  created_at: string
}

export async function createInvite(i: {
  from_id: string
  from_name: string | null
  to_id: string
  to_name: string | null
  message: string | null
  scope_type?: 'collab' | 'event'
  scope_id?: string | null
  role?: string | null
  room_id?: string | null // target group room (group invite) — set at creation
  occasion_id?: string | null
  occasion_label?: string | null
}): Promise<CollabInvite> {
  const scopeType = i.scope_type ?? 'collab'
  const scopeId = i.scope_id ?? null
  const roomId = i.room_id ?? null
  // Avoid duplicate pending invites. Group invites dedupe per target room;
  // others dedupe per (from, to, scope).
  let dup = db().from('collab_invites').select('*').eq('to_id', i.to_id).eq('status', 'pending')
  if (roomId) {
    dup = dup.eq('room_id', roomId)
  } else {
    dup = dup.eq('from_id', i.from_id).eq('scope_type', scopeType)
    dup = scopeId ? dup.eq('scope_id', scopeId) : dup.is('scope_id', null)
  }
  const existing = await dup.maybeSingle()
  if (existing.data) return existing.data as CollabInvite

  const { data, error } = await db()
    .from('collab_invites')
    .insert({
      from_id: i.from_id,
      from_name: i.from_name,
      to_id: i.to_id,
      to_name: i.to_name,
      message: i.message,
      scope_type: scopeType,
      scope_id: scopeId,
      role: i.role ?? null,
      room_id: roomId,
      occasion_id: i.occasion_id ?? null,
      occasion_label: i.occasion_label ?? null,
      status: 'pending',
    })
    .select()
    .single()
  if (error || !data) throw new Error(`Failed to send invite: ${error?.message}`)
  return data as CollabInvite
}

// ─── Group collab rooms (multi-party) ────────────────────────────────────────
export async function createGroupRoom(o: {
  owner_id: string
  owner_name: string | null
  title: string
  occasion_id?: string | null
  occasion_label?: string | null
}): Promise<CollabRoom> {
  const { data, error } = await db()
    .from('collab_rooms')
    .insert({
      member_a: o.owner_id,
      member_a_name: o.owner_name,
      member_b: o.owner_id, // satisfies NOT NULL; group membership lives in collab_room_members
      member_b_name: o.owner_name,
      is_group: true,
      title: o.title,
      owner_id: o.owner_id,
      occasion_id: o.occasion_id ?? null,
      occasion_label: o.occasion_label ?? null,
    })
    .select()
    .single()
  if (error || !data) throw new Error(`Failed to create group: ${error?.message}`)
  const room = data as CollabRoom
  // Owner is a member, and counts as "in" from the start.
  await addRoomMember(room.id, o.owner_id, o.owner_name, true)
  return room
}

// A collaboration's single group room — one per (owner, occasion). Created on
// first group invite within that collaboration, reused thereafter.
export async function getOrCreateOccasionGroupRoom(o: {
  owner_id: string
  owner_name: string | null
  occasion_id: string
  occasion_label: string | null
  title: string
}): Promise<CollabRoom> {
  const { data: existing } = await db()
    .from('collab_rooms')
    .select('*')
    .eq('owner_id', o.owner_id)
    .eq('occasion_id', o.occasion_id)
    .eq('is_group', true)
    .maybeSingle()
  if (existing) return existing as CollabRoom
  return createGroupRoom({
    owner_id: o.owner_id,
    owner_name: o.owner_name,
    title: o.title || o.occasion_label || 'Collaboration',
    occasion_id: o.occasion_id,
    occasion_label: o.occasion_label,
  })
}

export interface CollaborationMember {
  invite_id: string
  to_id: string
  to_name: string | null
  status: InviteStatus
  role: string | null
}

// One collaboration = one occasion = ONE chat room. It's a 1:1 when a single
// collaborator accepted, and auto-becomes a group once 2+ have accepted.
export interface CollaborationSummary {
  occasion_id: string
  label: string
  roomId: string | null
  eventId: string | null
  owned: boolean // true = we created it (can invite/manage); false = we were invited
  acceptedCount: number // collaborators (not the owner) who accepted
  members: CollaborationMember[] // invitees (only populated for owned collaborations)
  // When and where, once the event exists. All three are TEXT on vendor_events
  // (event_date is TEXT to match connector date strings), so treat the date as a
  // hint, not a timestamp — see collabWhen() in lib/collab-status.
  eventDate: string | null
  eventTime: string | null
  eventLocation: string | null
  // Consent state, from the room roster. Accepting an invite puts you in the
  // room; "I'm in 👍" is the actual commitment — so these are what tell you
  // whether a collaboration is waiting on YOU (see lib/collab-status).
  myAgreed: boolean
  agreedCount: number // everyone who's in, including you
  memberCount: number // everyone in the room, agreed or not
}

export async function getCollaborationsFor(memberId: string): Promise<CollaborationSummary[]> {
  const [invRes, ownedRoomRes, membershipRes] = await Promise.all([
    db().from('collab_invites').select('*').eq('from_id', memberId).not('occasion_id', 'is', null),
    db().from('collab_rooms').select('*').eq('owner_id', memberId).not('occasion_id', 'is', null),
    db().from('collab_room_members').select('room_id').eq('member_id', memberId),
  ])
  const invites = (invRes.data as CollabInvite[]) ?? []
  const ownedRooms = (ownedRoomRes.data as CollabRoom[]) ?? []

  const byOcc = new Map<string, CollaborationSummary>()

  // ── Owned collaborations (we created them) ──
  const roomByOcc = new Map<string, CollabRoom>()
  for (const r of ownedRooms) if (r.occasion_id) roomByOcc.set(r.occasion_id, r)
  const ensureOwned = (occ: string, label: string) => {
    if (!byOcc.has(occ)) {
      const room = roomByOcc.get(occ) || null
      byOcc.set(occ, {
        occasion_id: occ, label, roomId: room?.id ?? null, eventId: room?.event_id ?? null,
        owned: true, acceptedCount: 0, members: [], eventDate: null, eventTime: null, eventLocation: null,
        myAgreed: false, agreedCount: 0, memberCount: 0, // filled from the roster below
      })
    }
    return byOcc.get(occ)!
  }
  for (const [occ, room] of roomByOcc) ensureOwned(occ, room.occasion_label || room.title || 'Collaboration')
  for (const inv of invites) {
    if (!inv.occasion_id) continue
    const c = ensureOwned(inv.occasion_id, inv.occasion_label || 'Collaboration')
    c.members.push({ invite_id: inv.id, to_id: inv.to_id, to_name: inv.to_name, status: inv.status, role: inv.role })
    if (inv.status === 'accepted') c.acceptedCount += 1
  }

  // ── Joined collaborations (we were invited into someone else's) ──
  const myRoomIds = ((membershipRes.data as { room_id: string }[]) ?? []).map((m) => m.room_id)
  const ownedIds = new Set(ownedRooms.map((r) => r.id))
  const joinedIds = myRoomIds.filter((id) => !ownedIds.has(id))
  if (joinedIds.length > 0) {
    const { data: joinedRooms } = await db().from('collab_rooms').select('*').in('id', joinedIds)
    for (const room of (joinedRooms as CollabRoom[]) ?? []) {
      if (!room.occasion_id || byOcc.has(room.occasion_id)) continue
      byOcc.set(room.occasion_id, {
        occasion_id: room.occasion_id,
        label: room.occasion_label || room.title || 'Collaboration',
        roomId: room.id,
        eventId: room.event_id ?? null,
        owned: false,
        acceptedCount: 0, // from the roster below (was a per-room query — an N+1)
        members: [],
        eventDate: null,
        eventTime: null,
        eventLocation: null,
        myAgreed: false,
        agreedCount: 0,
        memberCount: 0,
      })
    }
  }

  // ── Consent state: one roster query for every room, owned or joined ──
  const collabs = [...byOcc.values()]
  const roomIds = collabs.map((c) => c.roomId).filter((id): id is string => !!id)
  if (roomIds.length > 0) {
    const { data } = await db()
      .from('collab_room_members')
      .select('room_id, member_id, agreed')
      .in('room_id', roomIds)
    const byRoom = new Map<string, { member_id: string; agreed: boolean }[]>()
    for (const r of (data as { room_id: string; member_id: string; agreed: boolean }[]) ?? []) {
      byRoom.set(r.room_id, [...(byRoom.get(r.room_id) ?? []), r])
    }
    for (const c of collabs) {
      const roster = (c.roomId && byRoom.get(c.roomId)) || []
      c.memberCount = roster.length
      c.agreedCount = roster.filter((r) => r.agreed).length
      c.myAgreed = roster.some((r) => r.member_id === memberId && r.agreed)
      // Joined collaborations have no invite rows to count — the roster is the
      // only source for "how many others are here".
      if (!c.owned) c.acceptedCount = Math.max(0, roster.length - 1)
    }
  }

  // ── When and where: one query for every collaboration that made an event.
  // The date is what the lists sort on (soonest first); all three show on the
  // card, so you can tell what's happening without opening anything.
  const eventIds = collabs.map((c) => c.eventId).filter((id): id is string => !!id)
  if (eventIds.length > 0) {
    const { data } = await db()
      .from('vendor_events')
      .select('id, event_date, event_time, location')
      .in('id', eventIds)
    type Row = { id: string; event_date: string | null; event_time: string | null; location: string | null }
    const byId = new Map(((data as Row[]) ?? []).map((e) => [e.id, e]))
    for (const c of collabs) {
      const e = c.eventId ? byId.get(c.eventId) : undefined
      c.eventDate = e?.event_date ?? null
      c.eventTime = e?.event_time ?? null
      c.eventLocation = e?.location ?? null
    }
  }

  return collabs
}

// Promote an "outing" (a set of individual invites sharing occasion_id) into a
// single group room. Everyone who ACCEPTED their invite is added already-agreed
// (they said yes), so the owner can create the event once >2 are in.
export async function promoteOccasionToGroup(o: {
  owner_id: string
  owner_name: string | null
  occasion_id: string
  title: string
}): Promise<{ room: CollabRoom; added: number }> {
  const { data } = await db()
    .from('collab_invites')
    .select('*')
    .eq('from_id', o.owner_id)
    .eq('occasion_id', o.occasion_id)
    .eq('status', 'accepted')
  const accepted = (data as CollabInvite[]) ?? []
  const room = await createGroupRoom({ owner_id: o.owner_id, owner_name: o.owner_name, title: o.title })
  await Promise.all(
    accepted.map((inv) => addRoomMember(room.id, inv.to_id, inv.to_name, true).catch(() => null))
  )
  return { room, added: accepted.length }
}

export async function addRoomMember(
  roomId: string,
  memberId: string,
  memberName: string | null,
  agreed = false
): Promise<void> {
  await db()
    .from('collab_room_members')
    .upsert({ room_id: roomId, member_id: memberId, member_name: memberName, agreed }, { onConflict: 'room_id,member_id' })
}

export async function getRoomMembers(roomId: string): Promise<RoomMember[]> {
  const { data } = await db()
    .from('collab_room_members')
    .select('*')
    .eq('room_id', roomId)
    .order('created_at', { ascending: true })
  return (data as RoomMember[]) ?? []
}

// Members for any room — group rooms already have rows; 1:1 rooms are seeded
// lazily from member_a/member_b so they support the same "I'm in" agreement.
export async function ensureRoomMembers(roomId: string): Promise<RoomMember[]> {
  const existing = await getRoomMembers(roomId)
  if (existing.length > 0) return existing
  const room = await getRoom(roomId)
  if (!room) return []
  await addRoomMember(roomId, room.member_a, room.member_a_name ?? null, false)
  if (room.member_b && room.member_b !== room.member_a) {
    await addRoomMember(roomId, room.member_b, room.member_b_name ?? null, false)
  }
  return getRoomMembers(roomId)
}

export async function setMemberAgreed(roomId: string, memberId: string, agreed: boolean): Promise<void> {
  await db().from('collab_room_members').update({ agreed }).eq('room_id', roomId).eq('member_id', memberId)
}

// All invites for an event (the lineup, any status).
export async function getEventInvites(eventId: string): Promise<CollabInvite[]> {
  const { data, error } = await db()
    .from('collab_invites')
    .select('*')
    .eq('scope_type', 'event')
    .eq('scope_id', eventId)
    .order('created_at', { ascending: false })
  if (error || !data) return []
  return data as CollabInvite[]
}

// Member ids who accepted an event invite (the confirmed lineup).
export async function getAcceptedLineup(eventId: string): Promise<CollabInvite[]> {
  return (await getEventInvites(eventId)).filter((i) => i.status === 'accepted')
}

// Batched accepted-lineup lookup for many events at once (one query, no N+1).
// Used by the public events feed to show "N businesses teamed up" on cards —
// makes the collaboration engine visible to shoppers. Count includes the host.
export async function getAcceptedLineupCounts(
  eventIds: string[]
): Promise<Record<string, { count: number; names: string[]; members: LineupMember[] }>> {
  const out: Record<string, { count: number; names: string[]; members: LineupMember[] }> = {}
  if (eventIds.length === 0) return out
  const { data, error } = await db()
    .from('collab_invites')
    .select('scope_id,to_id,to_name')
    .eq('scope_type', 'event')
    .eq('status', 'accepted')
    .in('scope_id', eventIds)
  if (error || !data) return out
  for (const row of data as { scope_id: string; to_id: string; to_name: string | null }[]) {
    const e = (out[row.scope_id] ??= { count: 1, names: [], members: [] }) // +1 for the host
    e.count += 1
    if (row.to_name) e.names.push(row.to_name)
    e.members.push({ id: row.to_id, name: row.to_name })
  }
  return out
}

/** One collaborator on an event lineup — enough to render an avatar + link. */
export interface LineupMember {
  id: string
  name: string | null
}

// Organizer-side approve/decline of an event lineup entry (e.g. a self-join
// request). Scoped to the event so the host can only touch their own lineup.
export async function setEventInviteStatus(
  inviteId: string,
  eventId: string,
  status: InviteStatus
): Promise<void> {
  const { error } = await db()
    .from('collab_invites')
    .update({ status })
    .eq('id', inviteId)
    .eq('scope_type', 'event')
    .eq('scope_id', eventId)
  if (error) throw new Error(`Failed to update lineup entry: ${error.message}`)
}

// A single invite by id (used by notification triggers to find the sender).
export async function getInvite(id: string): Promise<CollabInvite | null> {
  const { data } = await db().from('collab_invites').select('*').eq('id', id).maybeSingle()
  return (data as CollabInvite) ?? null
}

export async function getInvitesFor(memberId: string): Promise<{ incoming: CollabInvite[]; outgoing: CollabInvite[] }> {
  const [inc, out] = await Promise.all([
    db().from('collab_invites').select('*').eq('to_id', memberId).order('created_at', { ascending: false }),
    db().from('collab_invites').select('*').eq('from_id', memberId).order('created_at', { ascending: false }),
  ])
  return {
    incoming: (inc.data as CollabInvite[]) ?? [],
    outgoing: (out.data as CollabInvite[]) ?? [],
  }
}

// Accept an invite (scoped to the invitee) → create a room and link it.
export async function acceptInvite(id: string, inviteeId: string): Promise<CollabRoom | null> {
  const { data: invite } = await db()
    .from('collab_invites')
    .select('*')
    .eq('id', id)
    .eq('to_id', inviteeId)
    .maybeSingle()
  if (!invite) return null
  const inv = invite as CollabInvite

  // Event-scoped invites have no 1:1 room — accepting just joins the lineup,
  // which is the shared event thread.
  if (inv.scope_type === 'event') {
    if (inv.status !== 'accepted') {
      await db().from('collab_invites').update({ status: 'accepted' }).eq('id', id)
    }
    return null
  }

  // Group invites point at an existing multi-party room — accepting joins it.
  if (inv.room_id) {
    await addRoomMember(inv.room_id, inv.to_id, inv.to_name, false)
    if (inv.status !== 'accepted') {
      await db().from('collab_invites').update({ status: 'accepted' }).eq('id', id)
    }
    return await getRoom(inv.room_id)
  }

  if (inv.status === 'accepted' && inv.room_id) {
    const { data: room } = await db().from('collab_rooms').select('*').eq('id', inv.room_id).maybeSingle()
    return (room as CollabRoom) ?? null
  }

  const { data: room, error } = await db()
    .from('collab_rooms')
    .insert({
      member_a: inv.from_id,
      member_a_name: inv.from_name,
      member_b: inv.to_id,
      member_b_name: inv.to_name,
    })
    .select()
    .single()
  if (error || !room) throw new Error(`Failed to create room: ${error?.message}`)

  await db().from('collab_invites').update({ status: 'accepted', room_id: (room as CollabRoom).id }).eq('id', id)
  return room as CollabRoom
}

export async function declineInvite(id: string, inviteeId: string): Promise<void> {
  await db().from('collab_invites').update({ status: 'declined' }).eq('id', id).eq('to_id', inviteeId)
}

export async function getRoomsFor(memberId: string): Promise<CollabRoom[]> {
  // 1:1 rooms (member_a/member_b) + group rooms via membership.
  const [own, memberships] = await Promise.all([
    db().from('collab_rooms').select('*').or(`member_a.eq.${memberId},member_b.eq.${memberId}`),
    db().from('collab_room_members').select('room_id').eq('member_id', memberId),
  ])
  const byId = new Map<string, CollabRoom>()
  for (const r of (own.data as CollabRoom[]) ?? []) byId.set(r.id, r)

  const extraIds = ((memberships.data as { room_id: string }[]) ?? [])
    .map((m) => m.room_id)
    .filter((id) => !byId.has(id))
  if (extraIds.length > 0) {
    const { data } = await db().from('collab_rooms').select('*').in('id', extraIds)
    for (const r of (data as CollabRoom[]) ?? []) byId.set(r.id, r)
  }
  return [...byId.values()].sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
}

// Every message in the member's rooms, reduced to what an unread badge needs:
// which room, when, and whether it was theirs. The client compares `at` against
// its own per-room "last seen" to count what's new.
export async function getRoomActivity(
  memberId: string,
): Promise<{ key: string; at: string; mine: boolean }[]> {
  const rooms = await getRoomsFor(memberId)
  const ids = rooms.map((r) => r.id)
  if (ids.length === 0) return []
  const { data } = await db()
    .from('collab_messages')
    .select('room_id, sender_id, created_at')
    .in('room_id', ids)
    .order('created_at', { ascending: false })
    .limit(2000)
  return ((data as { room_id: string; sender_id: string; created_at: string }[]) ?? []).map((m) => ({
    key: m.room_id,
    at: m.created_at,
    mine: m.sender_id === memberId,
  }))
}

export async function getRoom(roomId: string): Promise<CollabRoom | null> {
  const { data } = await db().from('collab_rooms').select('*').eq('id', roomId).maybeSingle()
  return (data as CollabRoom) ?? null
}

export async function isRoomMember(roomId: string, memberId: string): Promise<boolean> {
  const { data } = await db()
    .from('collab_rooms')
    .select('id')
    .eq('id', roomId)
    .or(`member_a.eq.${memberId},member_b.eq.${memberId}`)
    .maybeSingle()
  if (data) return true
  const { data: m } = await db()
    .from('collab_room_members')
    .select('id')
    .eq('room_id', roomId)
    .eq('member_id', memberId)
    .maybeSingle()
  return !!m
}

export async function getMessages(roomId: string): Promise<CollabMessage[]> {
  const { data, error } = await db()
    .from('collab_messages')
    .select('*')
    .eq('room_id', roomId)
    .order('created_at', { ascending: true })
  if (error || !data) return []
  return data as CollabMessage[]
}

export async function sendMessage(m: {
  room_id: string
  sender_id: string
  sender_name: string | null
  text: string
}): Promise<CollabMessage> {
  const { data, error } = await db().from('collab_messages').insert(m).select().single()
  if (error || !data) throw new Error(`Failed to send: ${error?.message}`)
  return data as CollabMessage
}
