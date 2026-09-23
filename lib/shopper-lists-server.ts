import 'server-only'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

// The durable half of shopper lists. The browser half (lib/shopper-lists.ts)
// is now only the signed-out draft; everything a signed-in person has lives
// here. See the 20260923120000 migration for why member_ids is an array.

export interface StoredShopperList {
  id: string
  name: string
  memberIds: string[]
  createdAt: string
}

const MAX_LISTS = 100
const MAX_MEMBERS_PER_LIST = 500
const MAX_NAME = 60

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

interface Row {
  id: string
  name: string
  member_ids: string[] | null
  created_at: string
}

function toList(row: Row): StoredShopperList {
  return {
    id: row.id,
    name: row.name,
    memberIds: (row.member_ids ?? []).filter((id) => typeof id === 'string'),
    createdAt: row.created_at,
  }
}

export function cleanName(name: string): string {
  return name.trim().slice(0, MAX_NAME)
}

/** Every list this person has, newest first. */
export async function getShopperLists(userId: string): Promise<StoredShopperList[]> {
  const { data, error } = await db()
    .from('shopper_lists')
    .select('id, name, member_ids, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(MAX_LISTS)
  if (error || !data) return []
  return (data as Row[]).map(toList)
}

async function findByName(userId: string, name: string): Promise<Row | null> {
  const { data } = await db()
    .from('shopper_lists')
    .select('id, name, member_ids, created_at')
    .eq('user_id', userId)
    .ilike('name', name)
    .limit(1)
  const rows = (data as Row[] | null) ?? []
  return rows[0] ?? null
}

/**
 * Create a list, or fold the members into the existing list of that name.
 * Idempotent by name, which is what lets the localStorage merge run on every
 * sign-in without multiplying lists.
 */
export async function upsertShopperList(
  userId: string,
  name: string,
  memberIds: string[] = [],
): Promise<StoredShopperList[]> {
  const clean = cleanName(name)
  if (!clean) return getShopperLists(userId)

  const ids = Array.from(new Set(memberIds.filter((id) => typeof id === 'string' && id))).slice(
    0,
    MAX_MEMBERS_PER_LIST,
  )
  const existing = await findByName(userId, clean)

  if (existing) {
    // New ids lead — the thing you just added is the thing you want to see.
    const merged = Array.from(new Set([...ids, ...(existing.member_ids ?? [])])).slice(
      0,
      MAX_MEMBERS_PER_LIST,
    )
    const { error } = await db()
      .from('shopper_lists')
      .update({ member_ids: merged, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
      .eq('user_id', userId)
    if (error) throw new Error(`Failed to update list: ${error.message}`)
    return getShopperLists(userId)
  }

  const { count } = await db()
    .from('shopper_lists')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
  if ((count ?? 0) >= MAX_LISTS) throw new Error('You have reached the maximum number of lists')

  const { error } = await db()
    .from('shopper_lists')
    .insert({ user_id: userId, name: clean, member_ids: ids })
  // A concurrent create of the same name loses the unique index race; the row
  // it wanted now exists, so fold into it rather than failing the click.
  if (error && !/duplicate key|unique/i.test(error.message)) {
    throw new Error(`Failed to create list: ${error.message}`)
  }
  if (error) return upsertShopperList(userId, clean, ids)
  return getShopperLists(userId)
}

/** Add one business to one list, by list id. */
export async function addMemberToList(
  userId: string,
  listId: string,
  memberId: string,
): Promise<StoredShopperList[]> {
  const { data } = await db()
    .from('shopper_lists')
    .select('id, name, member_ids, created_at')
    .eq('id', listId)
    .eq('user_id', userId)
    .limit(1)
  const row = ((data as Row[] | null) ?? [])[0]
  if (!row) return getShopperLists(userId)

  const current = row.member_ids ?? []
  if (current.includes(memberId)) return getShopperLists(userId)

  const { error } = await db()
    .from('shopper_lists')
    .update({
      member_ids: [memberId, ...current].slice(0, MAX_MEMBERS_PER_LIST),
      updated_at: new Date().toISOString(),
    })
    .eq('id', listId)
    .eq('user_id', userId)
  if (error) throw new Error(`Failed to add to list: ${error.message}`)
  return getShopperLists(userId)
}

export async function removeMemberFromList(
  userId: string,
  listId: string,
  memberId: string,
): Promise<StoredShopperList[]> {
  const { data } = await db()
    .from('shopper_lists')
    .select('id, name, member_ids, created_at')
    .eq('id', listId)
    .eq('user_id', userId)
    .limit(1)
  const row = ((data as Row[] | null) ?? [])[0]
  if (!row) return getShopperLists(userId)

  const { error } = await db()
    .from('shopper_lists')
    .update({
      member_ids: (row.member_ids ?? []).filter((id) => id !== memberId),
      updated_at: new Date().toISOString(),
    })
    .eq('id', listId)
    .eq('user_id', userId)
  if (error) throw new Error(`Failed to remove from list: ${error.message}`)
  return getShopperLists(userId)
}

export async function deleteShopperList(userId: string, listId: string): Promise<StoredShopperList[]> {
  const { error } = await db().from('shopper_lists').delete().eq('id', listId).eq('user_id', userId)
  if (error) throw new Error(`Failed to delete list: ${error.message}`)
  return getShopperLists(userId)
}

/**
 * Lift the lists someone built before signing in into their account. Name
 * collisions merge rather than duplicate, so running this on every sign-in is
 * safe — and it has to be, because that's exactly when it runs.
 */
export async function mergeShopperLists(
  userId: string,
  incoming: { name: string; memberIds?: string[] }[],
): Promise<StoredShopperList[]> {
  for (const list of incoming.slice(0, MAX_LISTS)) {
    if (!list?.name) continue
    await upsertShopperList(userId, list.name, list.memberIds ?? [])
  }
  return getShopperLists(userId)
}
