// How much of the SF Legacy Business Registry do we already have?
//
//   npx tsx scripts/match-legacy-businesses.mts
//
// Answers the question that decides what the feed-seeding Phase 1 actually is
// (features/community-feed-seeding.md): is the registry NEW inventory, or an
// ENRICHMENT layer over businesses already in the directory?
//
// Matching is name-then-address, and deliberately conservative: a false match
// would attach someone else's founding year to a real business and publish it
// under our name. Anything uncertain is reported as unmatched, not guessed.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// Load .env.local the same way scripts/publish-events.ts does — no dotenv dep.
try {
  const raw = readFileSync(fileURLToPath(new URL('../.env.local', import.meta.url)), 'utf8')
  for (const line of raw.split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq === -1) continue
    const k = t.slice(0, eq).trim()
    let v = t.slice(eq + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    if (!process.env[k]) process.env[k] = v
  }
} catch {
  /* fall back to the ambient environment */
}

const { listMembers } = await import('../lib/api')
type Member = Awaited<ReturnType<typeof listMembers>>['members'][number]

interface LegacyRow {
  Business_Name: string
  Business_Address: string
  Established_Date: string
  Neighborhood: string
  Known_For: string
  Business_Description: string
  Business_Type: string
  Business_Website: string
  Latitude: number | null
  Longitude: number | null
}

/** Comparable business name: lowercase, no punctuation, no legal/filler words. */
const NOISE = /\b(the|inc|incorporated|llc|ltd|co|company|corp|and|of|sf|san francisco)\b/g
function normName(s: string): string {
  return (s || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’.,()\-\/]/g, ' ')
    .replace(NOISE, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** "2720 24th St." -> "2720 24th" — number + street stem, the stable part. */
const STREET_NOISE = /\b(st|street|ave|avenue|blvd|boulevard|rd|road|dr|drive|ln|lane|ct|court|pl|place|way|hwy|ste|suite|unit|#)\b/g
function normAddr(s: string): string {
  return (s || '')
    .toLowerCase()
    .replace(/['’.,()]/g, ' ')
    .replace(STREET_NOISE, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function memberName(m: Member): string {
  const p = (m.profile ?? {}) as Record<string, unknown>
  return String(p.businessName || p.name || '')
}
function memberAddr(m: Member): string {
  const p = (m.profile ?? {}) as Record<string, unknown>
  return String(p.businessAddress || '')
}

// ---- pull the whole directory (same cursor loop as lib/landing.ts) ----------
// NOTE: do NOT break on `batch.length < limit`, which is what
// lib/landing.ts fetchAllMembersUncached does. listMembers() filters
// HIDDEN_FROM_LISTINGS *after* the connector applies the limit, so a full page
// of 200 arrives as 199 and that test ends pagination on page one. Terminate on
// "this page added nothing new" instead, which is true regardless of filtering.
const PAGE = 200 // the connector's hard cap per request

async function allMembers(cap = 2000): Promise<Member[]> {
  const out: Member[] = []
  const seen = new Set<string>()
  let cursor: string | undefined
  for (let page = 0; page < 60 && out.length < cap; page++) {
    let batch: Member[]
    try {
      batch = (await listMembers({ limit: PAGE, cursor })).members
    } catch (err) {
      console.error('listMembers failed:', err instanceof Error ? err.message : err)
      break
    }
    if (!batch.length) break
    let oldest = 0
    let added = 0
    for (const m of batch) {
      const la = m.lastActiveAt
      const ms =
        typeof la === 'string' ? Date.parse(la) : la && typeof la === 'object' ? la._seconds * 1000 : 0
      if (ms && (oldest === 0 || ms < oldest)) oldest = ms
      if (seen.has(m.id)) continue
      seen.add(m.id)
      out.push(m)
      added++
    }
    if (added === 0 || !oldest) break
    cursor = String(oldest)
  }
  return out
}

const rows: LegacyRow[] = JSON.parse(
  readFileSync(fileURLToPath(new URL('../data/legacy-business-registry.json', import.meta.url)), 'utf8')
)

console.log('Fetching directory members…')
const members = await allMembers()
console.log(`  ${members.length} members\n`)

const byName = new Map<string, Member[]>()
const byAddr = new Map<string, Member[]>()
for (const m of members) {
  const n = normName(memberName(m))
  const a = normAddr(memberAddr(m))
  if (n) (byName.get(n) ?? byName.set(n, []).get(n)!).push(m)
  if (a) (byAddr.get(a) ?? byAddr.set(a, []).get(a)!).push(m)
}

// One entry per unique registry BUSINESS (not per location).
const businesses = new Map<string, LegacyRow>()
for (const r of rows) if (!businesses.has(r.Business_Name)) businesses.set(r.Business_Name, r)

const nameHits: { row: LegacyRow; m: Member }[] = []
const addrHits: { row: LegacyRow; m: Member }[] = []
const misses: LegacyRow[] = []

for (const r of businesses.values()) {
  const n = normName(r.Business_Name)
  const hitN = n ? byName.get(n) : undefined
  if (hitN?.length) {
    nameHits.push({ row: r, m: hitN[0] })
    continue
  }
  const a = normAddr(r.Business_Address)
  const hitA = a ? byAddr.get(a) : undefined
  if (hitA?.length) {
    addrHits.push({ row: r, m: hitA[0] })
    continue
  }
  misses.push(r)
}

const total = businesses.size
const matched = nameHits.length + addrHits.length
console.log('─'.repeat(64))
console.log(`Registry businesses:      ${total}`)
console.log(`  matched by name:        ${nameHits.length}`)
console.log(`  matched by address:     ${addrHits.length}`)
console.log(`  MATCHED total:          ${matched}  (${Math.round((matched / total) * 100)}%)`)
console.log(`  not in the directory:   ${misses.length}`)
console.log('─'.repeat(64))

console.log('\nSample matches (registry → directory):')
for (const { row, m } of [...nameHits, ...addrHits].slice(0, 12)) {
  console.log(`  ${row.Business_Name.slice(0, 34).padEnd(36)} → ${memberName(m).slice(0, 34)}`)
}

console.log('\nSample MISSES (registry businesses we do not have):')
for (const r of misses.slice(0, 15)) {
  console.log(`  ${r.Business_Name.slice(0, 40).padEnd(42)} ${r.Neighborhood}`)
}

const missHoods = new Map<string, number>()
for (const r of misses) missHoods.set(r.Neighborhood, (missHoods.get(r.Neighborhood) ?? 0) + 1)
console.log('\nMisses by neighborhood (top 10):')
for (const [h, c] of [...missHoods].sort((a, b) => b[1] - a[1]).slice(0, 10)) {
  console.log(`  ${String(c).padStart(4)}  ${h}`)
}
