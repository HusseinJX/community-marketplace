/**
 * Shopper lists — live DB smoke test.
 *
 * Runs against the REAL Supabase project under a throwaway user id and deletes
 * everything it made. Proves the three things the feature rests on:
 *   1. a list survives the write (the whole point — it used to be localStorage),
 *   2. create is idempotent by name, so the sign-in merge can run every time,
 *   3. one person cannot read or write another person's lists.
 *
 *   npx tsx scripts/shopper-lists-smoke.mts
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import Module from 'node:module'

try {
  const raw = readFileSync(fileURLToPath(new URL('../.env.local', import.meta.url)), 'utf8')
  for (const line of raw.split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq === -1) continue
    const key = t.slice(0, eq).trim()
    let v = t.slice(eq + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    if (!(key in process.env) || process.env[key] === '') process.env[key] = v
  }
} catch {
  console.warn('Could not load .env.local')
}

// lib/shopper-lists-server.ts imports 'server-only' — correct in the app (it
// holds the service-role key), meaningless in a script. Stub it rather than
// weaken the module.
const load = (Module as unknown as { _load: (...a: unknown[]) => unknown })._load
;(Module as unknown as { _load: unknown })._load = function (request: string, ...rest: unknown[]) {
  if (request === 'server-only') return {}
  return load.call(this, request, ...rest)
}

const {
  getShopperLists,
  upsertShopperList,
  addMemberToList,
  removeMemberFromList,
  mergeShopperLists,
  deleteShopperList,
} = await import('../lib/shopper-lists-server')

const USER = `smoke_user_${Date.now()}`
const OTHER = `smoke_other_${Date.now()}`

let passed = 0
let failed = 0
function check(label: string, ok: boolean, detail = '') {
  if (ok) {
    passed++
    console.log(`  ✓ ${label}`)
  } else {
    failed++
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

try {
  console.log('\nPersistence')
  let lists = await upsertShopperList(USER, 'Coffee crawl', ['pliq_361'])
  check('list created', lists.length === 1, `got ${lists.length}`)
  check('name stored', lists[0]?.name === 'Coffee crawl')
  check('member stored', lists[0]?.memberIds.includes('pliq_361'))

  const reread = await getShopperLists(USER)
  check('survives a fresh read', reread.length === 1 && reread[0].name === 'Coffee crawl')

  console.log('\nIdempotent by name (the sign-in merge runs on every device)')
  lists = await upsertShopperList(USER, 'Coffee crawl', ['pliq_999'])
  check('same name does not duplicate', lists.length === 1, `got ${lists.length}`)
  check('members merged', lists[0].memberIds.includes('pliq_361') && lists[0].memberIds.includes('pliq_999'))

  lists = await upsertShopperList(USER, 'COFFEE CRAWL', ['pliq_777'])
  check('case-insensitive match', lists.length === 1, `got ${lists.length}`)

  console.log('\nMerge from a signed-out draft')
  lists = await mergeShopperLists(USER, [
    { name: 'Coffee crawl', memberIds: ['pliq_555'] },
    { name: 'Saturday errands', memberIds: ['pliq_100'] },
  ])
  check('new draft list lands', lists.some((l) => l.name === 'Saturday errands'))
  check('existing list not duplicated', lists.filter((l) => /coffee crawl/i.test(l.name)).length === 1)
  check('merge is additive', lists.find((l) => /coffee/i.test(l.name))!.memberIds.includes('pliq_555'))

  const again = await mergeShopperLists(USER, [{ name: 'Coffee crawl', memberIds: ['pliq_555'] }])
  check('merging twice changes nothing', again.length === lists.length, `${again.length} vs ${lists.length}`)

  console.log('\nAdd / remove')
  const target = lists.find((l) => l.name === 'Saturday errands')!
  let after = await addMemberToList(USER, target.id, 'pliq_222')
  check('member added', after.find((l) => l.id === target.id)!.memberIds.includes('pliq_222'))
  after = await addMemberToList(USER, target.id, 'pliq_222')
  check('adding twice is idempotent',
    after.find((l) => l.id === target.id)!.memberIds.filter((id) => id === 'pliq_222').length === 1)
  after = await removeMemberFromList(USER, target.id, 'pliq_222')
  check('member removed', !after.find((l) => l.id === target.id)!.memberIds.includes('pliq_222'))

  console.log('\nIsolation between people')
  const otherLists = await getShopperLists(OTHER)
  check('another user sees nothing', otherLists.length === 0, `got ${otherLists.length}`)
  await addMemberToList(OTHER, target.id, 'pliq_hack')
  const untouched = await getShopperLists(USER)
  check('another user cannot write your list',
    !untouched.find((l) => l.id === target.id)!.memberIds.includes('pliq_hack'))
  await deleteShopperList(OTHER, target.id)
  check('another user cannot delete your list',
    (await getShopperLists(USER)).some((l) => l.id === target.id))
} finally {
  console.log('\nCleanup')
  for (const list of await getShopperLists(USER)) {
    await deleteShopperList(USER, list.id)
  }
  for (const list of await getShopperLists(OTHER)) {
    await deleteShopperList(OTHER, list.id)
  }
  const left = (await getShopperLists(USER)).length + (await getShopperLists(OTHER)).length
  check('rows cleaned up', left === 0, `${left} left`)
}

console.log(`\n${passed} passed, ${failed} failed\n`)
process.exit(failed ? 1 : 0)
