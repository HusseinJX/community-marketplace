import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Support chat — the data layer for a person talking to us and us talking back.
//
// EVERY write goes through here, which is what lets the unread counters on
// `support_threads` be trusted: `send()` is the only thing that increments them
// and `markRead()` the only thing that clears them. A second writer somewhere
// else is how a red badge starts lying.

let client: SupabaseClient | null = null
function db(): SupabaseClient {
  if (!client) {
    const url = process.env.SUPABASE_URL
    // Service-role is REQUIRED: the tables deny anon by design (see the
    // migration), so the anon fallback used elsewhere would read nothing.
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) throw new Error('Support chat needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
    client = createClient(url, key, { auth: { persistSession: false } })
  }
  return client
}

export type Sender = 'user' | 'staff'

export interface SupportMessage {
  id: string
  sender: Sender
  author_name: string | null
  body: string
  created_at: string
}

export interface SupportThread {
  id: string
  clerk_user_id: string
  display_name: string | null
  email: string | null
  member_id: string | null
  last_message_at: string | null
  last_sender: Sender | null
  preview: string | null
  user_unread: number
  staff_unread: number
  status: string
  created_at: string
}

/** A message is a message, not an essay — and not an empty bubble either. */
export const MAX_BODY = 4000

export function cleanBody(input: unknown): string {
  return typeof input === 'string' ? input.trim().slice(0, MAX_BODY) : ''
}

/** The person's thread, or null. Reading never creates one — an empty thread
 *  in the admin inbox is somebody who opened a screen, not somebody who asked. */
export async function getThread(clerkUserId: string): Promise<SupportThread | null> {
  const { data } = await db()
    .from('support_threads')
    .select('*')
    .eq('clerk_user_id', clerkUserId)
    .maybeSingle()
  return (data as SupportThread) ?? null
}

export async function getThreadById(id: string): Promise<SupportThread | null> {
  const { data } = await db().from('support_threads').select('*').eq('id', id).maybeSingle()
  return (data as SupportThread) ?? null
}

async function ensureThread(
  clerkUserId: string,
  meta: { displayName?: string | null; email?: string | null; memberId?: string | null } = {}
): Promise<SupportThread> {
  const existing = await getThread(clerkUserId)
  const patch = {
    display_name: meta.displayName ?? existing?.display_name ?? null,
    email: meta.email ?? existing?.email ?? null,
    member_id: meta.memberId ?? existing?.member_id ?? null,
  }
  if (existing) {
    // Refresh the denormalized identity — people rename their business and
    // change their email, and the inbox should not still show last year's.
    await db().from('support_threads').update(patch).eq('id', existing.id)
    return { ...existing, ...patch }
  }
  const { data, error } = await db()
    .from('support_threads')
    .insert({ clerk_user_id: clerkUserId, ...patch })
    .select()
    .single()
  if (error || !data) throw new Error(`Failed to open a support thread: ${error?.message}`)
  return data as SupportThread
}

export async function listMessages(threadId: string, limit = 200): Promise<SupportMessage[]> {
  const { data } = await db()
    .from('support_messages')
    .select('id, sender, author_name, body, created_at')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true })
    .limit(limit)
  return (data as SupportMessage[]) ?? []
}

/**
 * Append a message and move the thread's counters with it.
 *
 * The counter that goes UP is the other side's, and the sender's own goes to
 * zero: writing a reply means you have read what you are replying to. Skipping
 * that second half is how an inbox keeps a bold row nobody can clear.
 */
export async function send(opts: {
  clerkUserId: string
  sender: Sender
  body: string
  authorName?: string | null
  displayName?: string | null
  email?: string | null
  memberId?: string | null
}): Promise<{ thread: SupportThread; message: SupportMessage }> {
  const body = cleanBody(opts.body)
  if (!body) throw new Error('Empty message')

  const thread = await ensureThread(opts.clerkUserId, {
    displayName: opts.displayName,
    email: opts.email,
    memberId: opts.memberId,
  })

  const { data, error } = await db()
    .from('support_messages')
    .insert({
      thread_id: thread.id,
      sender: opts.sender,
      author_name: opts.authorName ?? null,
      body,
    })
    .select('id, sender, author_name, body, created_at')
    .single()
  if (error || !data) throw new Error(`Failed to send: ${error?.message}`)

  const fromUser = opts.sender === 'user'
  const counters = fromUser
    ? { staff_unread: thread.staff_unread + 1, user_unread: 0 }
    : { user_unread: thread.user_unread + 1, staff_unread: 0 }

  const { data: updated } = await db()
    .from('support_threads')
    .update({
      ...counters,
      last_message_at: data.created_at,
      last_sender: opts.sender,
      preview: body.slice(0, 160),
      updated_at: new Date().toISOString(),
      status: 'open',
    })
    .eq('id', thread.id)
    .select()
    .single()

  return { thread: (updated as SupportThread) ?? thread, message: data as SupportMessage }
}

/** Clear one side's badge. Never both: staff opening a thread does not mean the
 *  person has seen our reply. */
export async function markRead(threadId: string, who: Sender): Promise<void> {
  await db()
    .from('support_threads')
    .update(who === 'user' ? { user_unread: 0 } : { staff_unread: 0 })
    .eq('id', threadId)
}

/** What the red badge on the support card reads. Zero for someone who has
 *  never written — no thread, nothing unread. */
export async function unreadForUser(clerkUserId: string): Promise<number> {
  const { data } = await db()
    .from('support_threads')
    .select('user_unread')
    .eq('clerk_user_id', clerkUserId)
    .maybeSingle()
  return (data as { user_unread?: number } | null)?.user_unread ?? 0
}

/** The admin inbox: everyone who has ever written, ours-to-answer first. */
export async function listThreads(limit = 100): Promise<SupportThread[]> {
  const { data } = await db()
    .from('support_threads')
    .select('*')
    // Unanswered on top, then most recent. A support inbox sorted purely by
    // time buries the person still waiting under everyone we already replied to.
    .order('staff_unread', { ascending: false })
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .limit(limit)
  return (data as SupportThread[]) ?? []
}

/** Total threads waiting on us — the badge on the admin's Support tab. */
export async function staffWaitingCount(): Promise<number> {
  const { count } = await db()
    .from('support_threads')
    .select('id', { count: 'exact', head: true })
    .gt('staff_unread', 0)
  return count ?? 0
}
