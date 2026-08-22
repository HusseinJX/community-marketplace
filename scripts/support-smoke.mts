/**
 * Support chat, end to end against the REAL tables. Cleans up after itself.
 *
 *   npx tsx scripts/support-smoke.mts
 *
 * Checks the thing that is easy to get wrong and invisible when you do: the
 * unread counters. A badge that lies is worse than no badge.
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

const { send, getThread, listMessages, markRead, unreadForUser, listThreads } = await import('../lib/support')
const { createClient } = await import('@supabase/supabase-js')

const USER = `smoke-${Date.now()}`
let failures = 0
function check(label: string, ok: boolean, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures++
}

try {
  check('no thread before anyone writes', (await getThread(USER)) === null)
  check('unread is 0 for a stranger', (await unreadForUser(USER)) === 0)

  await send({ clerkUserId: USER, sender: 'user', body: 'my order never arrived', displayName: 'Smoke Tester', email: 'smoke@example.com' })
  let t = (await getThread(USER))!
  check('thread opened on first message', !!t)
  check('staff owes a reply', t.staff_unread === 1, `staff_unread=${t.staff_unread}`)
  check('nothing unread for the person', t.user_unread === 0)
  check('preview is their words', t.preview === 'my order never arrived')

  await send({ clerkUserId: USER, sender: 'staff', body: 'checking now', authorName: 'John' })
  t = (await getThread(USER))!
  check('replying clears our own badge', t.staff_unread === 0, `staff_unread=${t.staff_unread}`)
  check('their badge went up', t.user_unread === 1, `user_unread=${t.user_unread}`)
  check('badge read matches the row', (await unreadForUser(USER)) === 1)

  await markRead(t.id, 'user')
  check('reading clears their badge', (await unreadForUser(USER)) === 0)

  const msgs = await listMessages(t.id)
  check('both messages, oldest first', msgs.length === 2 && msgs[0].sender === 'user' && msgs[1].sender === 'staff')

  const threads = await listThreads()
  check('thread appears in the staff inbox', threads.some((x) => x.id === t.id))
} finally {
  const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
  await db.from('support_threads').delete().eq('clerk_user_id', USER) // messages cascade
  console.log(failures === 0 ? '\nAll good. Cleaned up.' : `\n${failures} FAILED. Cleaned up.`)
  process.exit(failures === 0 ? 0 : 1)
}
