import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Organizer-scoped tags for grouping onboarded businesses.
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

export interface MemberTag {
  id: string
  owner_id: string
  member_id: string
  member_name: string | null
  tag_slug: string
  tag_label: string
  created_at: string
}

export interface TagGroup {
  slug: string
  label: string
  members: { id: string; name: string | null }[]
}

export function slugifyTag(label: string): string {
  return label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

// Apply one or more tags (labels) to a member for an owner. Idempotent.
export async function addTags(
  ownerId: string,
  memberId: string,
  memberName: string | null,
  labels: string[]
): Promise<void> {
  const rows = labels
    .map((l) => l.trim())
    .filter(Boolean)
    .map((label) => ({
      owner_id: ownerId,
      member_id: memberId,
      member_name: memberName,
      tag_slug: slugifyTag(label),
      tag_label: label,
    }))
    .filter((r) => r.tag_slug)
  if (rows.length === 0) return
  const { error } = await db()
    .from('member_tags')
    .upsert(rows, { onConflict: 'owner_id,member_id,tag_slug' })
  if (error) throw new Error(`Failed to tag: ${error.message}`)
}

// All of an owner's tag groups with their members.
export async function getTagGroups(ownerId: string): Promise<TagGroup[]> {
  const { data, error } = await db()
    .from('member_tags')
    .select('*')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false })
  if (error || !data) return []
  const groups = new Map<string, TagGroup>()
  for (const r of data as MemberTag[]) {
    const g = groups.get(r.tag_slug) ?? { slug: r.tag_slug, label: r.tag_label, members: [] }
    if (!g.members.some((m) => m.id === r.member_id)) g.members.push({ id: r.member_id, name: r.member_name })
    groups.set(r.tag_slug, g)
  }
  return [...groups.values()]
}

export async function removeTag(ownerId: string, memberId: string, slug: string): Promise<void> {
  await db().from('member_tags').delete().eq('owner_id', ownerId).eq('member_id', memberId).eq('tag_slug', slug)
}
