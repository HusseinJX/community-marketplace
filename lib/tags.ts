import 'server-only'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { slugifyTag } from './member-tags'

// Public tags — where a business is, and what it was part of.
//
// See the 20260923160000 migration for the reasoning. The short version, which
// is the only thing worth carrying in your head:
//
//   Bounded THING → dates on the tag      (Outside Lands 2026)
//   Bounded EDGE  → dates on the member_tags row (this vendor, Saturdays only)
//   Neither       → no dates              (a business inside Oracle Park)

export type TagKind = 'venue' | 'market' | 'district' | 'festival' | 'brand'

export const TAG_KINDS: { kind: TagKind; label: string; hint: string }[] = [
  { kind: 'venue', label: 'Venue', hint: 'A place you can stand in — a stadium, a hall, a market building' },
  { kind: 'market', label: 'Market', hint: 'A recurring trading spot — a farmers market, a night market' },
  { kind: 'district', label: 'District', hint: 'A neighbourhood or a strip' },
  { kind: 'festival', label: 'Festival', hint: 'A bounded happening — give it dates' },
  { kind: 'brand', label: 'Brand', hint: "The thing several locations have in common" },
]

export interface Tag {
  id: string
  slug: string
  label: string
  kind: TagKind
  description: string | null
  lat: number | null
  lng: number | null
  starts_at: string | null
  ends_at: string | null
  parent_id: string | null
}

export interface MemberTagLink {
  tag: Tag
  starts_at: string | null
  ends_at: string | null
  recurrence: string | null
  role: string | null
}

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

const TAG_COLS = 'id, slug, label, kind, description, lat, lng, starts_at, ends_at, parent_id'

/** Find tags by name, for the picker. */
export async function searchTags(q: string, limit = 8): Promise<Tag[]> {
  const term = q.trim()
  if (term.length < 1) return listTags(limit)
  const { data } = await db()
    .from('tags')
    .select(TAG_COLS)
    .ilike('label', `%${term}%`)
    .order('label')
    .limit(limit)
  return (data as Tag[]) ?? []
}

export async function listTags(limit = 50): Promise<Tag[]> {
  const { data } = await db().from('tags').select(TAG_COLS).order('label').limit(limit)
  return (data as Tag[]) ?? []
}

export async function getTagBySlug(slug: string): Promise<Tag | null> {
  const { data } = await db().from('tags').select(TAG_COLS).eq('slug', slug).limit(1)
  return ((data as Tag[]) ?? [])[0] ?? null
}

/**
 * Create a tag, or return the one that already has that slug.
 *
 * Idempotent by slug because two people canvassing the same market must not
 * produce "Ferry Plaza" and "ferry plaza" as separate pages.
 */
export async function upsertTag(input: {
  label: string
  kind?: TagKind
  description?: string | null
  lat?: number | null
  lng?: number | null
  startsAt?: string | null
  endsAt?: string | null
  parentId?: string | null
  createdBy?: string | null
}): Promise<Tag> {
  const label = input.label.trim().slice(0, 120)
  if (!label) throw new Error('A tag needs a name')
  const slug = slugifyTag(label)

  const existing = await getTagBySlug(slug)
  if (existing) return existing

  const { data, error } = await db()
    .from('tags')
    .insert({
      slug,
      label,
      kind: input.kind ?? 'venue',
      description: input.description ?? null,
      lat: input.lat ?? null,
      lng: input.lng ?? null,
      starts_at: input.startsAt ?? null,
      ends_at: input.endsAt ?? null,
      parent_id: input.parentId ?? null,
      created_by: input.createdBy ?? null,
    })
    .select(TAG_COLS)
    .single()
  // Lost the race with another writer — the row it wanted now exists.
  if (error) {
    const again = await getTagBySlug(slug)
    if (again) return again
    throw new Error(`Failed to create tag: ${error.message}`)
  }
  return data as Tag
}

/** Put a member in a tag. Idempotent per (member, tag). */
export async function tagMember(
  memberId: string,
  memberName: string | null,
  tagId: string,
  opts?: { startsAt?: string | null; endsAt?: string | null; recurrence?: string | null; role?: string | null },
): Promise<void> {
  const tag = await getTagById(tagId)
  if (!tag) throw new Error('That tag no longer exists')
  const { error } = await db()
    .from('member_tags')
    .upsert(
      {
        // owner_id is null for a public tag — it belongs to nobody. The old
        // private rows keep theirs.
        owner_id: null,
        member_id: memberId,
        member_name: memberName,
        tag_id: tagId,
        // The legacy columns are NOT NULL and still feed the private grouping
        // UI, so they are kept in step rather than left to guess.
        tag_slug: tag.slug,
        tag_label: tag.label,
        starts_at: opts?.startsAt ?? null,
        ends_at: opts?.endsAt ?? null,
        recurrence: opts?.recurrence ?? null,
        role: opts?.role ?? null,
      },
      { onConflict: 'member_id,tag_id' },
    )
  if (error) throw new Error(`Failed to tag: ${error.message}`)
}

export async function untagMember(memberId: string, tagId: string): Promise<void> {
  await db().from('member_tags').delete().eq('member_id', memberId).eq('tag_id', tagId)
}

async function getTagById(id: string): Promise<Tag | null> {
  const { data } = await db().from('tags').select(TAG_COLS).eq('id', id).limit(1)
  return ((data as Tag[]) ?? [])[0] ?? null
}

/** The chips on a business profile. */
export async function getTagsForMember(memberId: string): Promise<MemberTagLink[]> {
  const { data } = await db()
    .from('member_tags')
    .select(`starts_at, ends_at, recurrence, role, tags!inner(${TAG_COLS})`)
    .eq('member_id', memberId)
    .not('tag_id', 'is', null)
  type Row = { starts_at: string | null; ends_at: string | null; recurrence: string | null; role: string | null; tags: Tag | Tag[] }
  return ((data as Row[]) ?? []).map((r) => ({
    tag: (Array.isArray(r.tags) ? r.tags[0] : r.tags) as Tag,
    starts_at: r.starts_at,
    ends_at: r.ends_at,
    recurrence: r.recurrence,
    role: r.role,
  }))
}

/** Everyone in a tag — the tag page. */
export async function getMembersForTag(
  tagId: string,
  limit = 200,
): Promise<{ id: string; name: string | null; role: string | null; recurrence: string | null }[]> {
  const { data } = await db()
    .from('member_tags')
    .select('member_id, member_name, role, recurrence')
    .eq('tag_id', tagId)
    .order('created_at', { ascending: false })
    .limit(limit)
  return ((data as { member_id: string; member_name: string | null; role: string | null; recurrence: string | null }[]) ?? []).map(
    (r) => ({ id: r.member_id, name: r.member_name, role: r.role, recurrence: r.recurrence }),
  )
}

/**
 * Is this tag live right now?
 *
 * Only a bounded THING can be over. An edge's dates say when that member is
 * there, which is a different question and belongs on the row, not here.
 */
export function tagIsCurrent(tag: Tag, now = new Date()): boolean {
  if (tag.ends_at && new Date(tag.ends_at) < now) return false
  if (tag.starts_at && new Date(tag.starts_at) > now) return false
  return true
}
