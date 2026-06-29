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
    })
    .select()
    .single()
  if (error || !data) throw new Error(`Failed to create group: ${error?.message}`)
  const room = data as CollabRoom
  // Owner is a member, and counts as "in" from the start.
  await addRoomMember(room.id, o.owner_id, o.owner_name, true)
  return room
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
