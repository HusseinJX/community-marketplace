// Verify a REAL Square connection end to end, one command per click of Connect.
//
//   npx tsx scripts/square-verify.mts <memberId>
//
// This is the test the sandbox can't be: pasting a sandbox token bypasses
// Composio entirely, so it proves nothing about link(), the borrowed OAuth
// token, or the scopes on the auth config. Everything here runs against the
// production connection the vendor actually authorized.
//
// READ-ONLY against Square. It never creates a booking — a booking is a real
// appointment in a real business's calendar, and a smoke test has no business
// putting one there. The one write it can make is ours: getSquareCreds() caches
// a resolved location id into vendor_secrets, which is the normal flow.
//
// Exit code is 0 only if every check passed.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

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

const MEMBER = process.argv[2]
if (!MEMBER) {
  console.error('Usage: npx tsx scripts/square-verify.mts <memberId>')
  process.exit(2)
}

const { createClient } = await import('@supabase/supabase-js')
const { getComposio, authConfigIdFor, runTool, TOOL_SLUGS } = await import('../lib/composio')
const { getStoreAccessToken } = await import('../lib/composio-commerce')
const sq = await import('../lib/square-appointments')

const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
})

// Every scope the code actually needs, and what breaks without each one — so a
// missing scope reads as a consequence rather than a string.
const REQUIRED_SCOPES: Record<string, string> = {
  ITEMS_READ: 'catalog sync + finding bookable services',
  MERCHANT_PROFILE_READ: 'reading locations (availability needs a location id)',
  APPOINTMENTS_READ: 'showing real open slots',
  APPOINTMENTS_WRITE: 'taking a booking',
  CUSTOMERS_WRITE: 'Square requires a customer on every booking',
  ORDERS_WRITE: 'pushing a completed sale back into their Square',
}

let pass = 0
let fail = 0
let warn = 0
function check(label: string, ok: boolean, detail = '') {
  if (ok) {
    pass++
    console.log(`  ✓ ${label}`)
  } else {
    fail++
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`)
  }
}
function note(label: string) {
  warn++
  console.log(`  · ${label}`)
}
function describe(e: unknown): string {
  if (e instanceof sq.SquareError) {
    return e.code ? `${e.code}: ${e.message}` : `${e.status} ${e.message}`
  }
  return e instanceof Error ? e.message : String(e)
}

console.log(`\nVerifying Square for member "${MEMBER}"`)

// ── 1. Config ───────────────────────────────────────────────────────────────
console.log('\nAuth config')
let authConfigOk = false
try {
  const id = authConfigIdFor('square')
  const cfg = (await getComposio().authConfigs.get(id)) as {
    credentials?: { scopes?: string[] }
    noOfConnections?: number
    status?: string
  }
  authConfigOk = true
  check('auth config readable', true)
  check('enabled', cfg.status !== 'DISABLED', `status=${cfg.status}`)

  const scopes = cfg.credentials?.scopes ?? []
  for (const [scope, why] of Object.entries(REQUIRED_SCOPES)) {
    check(`scope ${scope}`, scopes.includes(scope), `needed for ${why}`)
  }
} catch (e) {
  check('auth config readable', false, describe(e))
}

// ── 1b. Tool slugs ──────────────────────────────────────────────────────────
// Needs no connection, and it's the check that was missing: SQUARE_LIST_CATALOG
// never existed, so catalog sync could not have worked for anyone. An invented
// slug fails at call time with "Unable to retrieve tool with slug", which in a
// fire-and-forget path is a log line nobody reads.
console.log('\nTool slugs')
if (authConfigOk) {
  for (const [label, slug] of Object.entries(TOOL_SLUGS.square)) {
    try {
      await getComposio().tools.getRawComposioToolBySlug(slug)
      check(`${slug} resolves (${label})`, true)
    } catch (e) {
      check(`${slug} resolves (${label})`, false, describe(e))
    }
  }
}

// ── 2. The connection ───────────────────────────────────────────────────────
console.log('\nConnection')
if (authConfigOk) {
  try {
    const { items } = await getComposio().connectedAccounts.list({
      userIds: [MEMBER],
      toolkitSlugs: ['square'],
      statuses: ['ACTIVE'],
    })
    const active = items?.[0]
    check('an ACTIVE Square connection exists for this member', !!active,
      'nobody has authorized yet — click Connect Square in /vendor/integrations first')
    if (active) console.log(`      connection ${active.id}`)
  } catch (e) {
    check('could list connected accounts', false, describe(e))
  }
}

const { data: settings } = await db
  .from('vendor_settings')
  .select('composio_platform, composio_connection_id')
  .eq('member_id', MEMBER)
  .maybeSingle()
check('vendor_settings records the connection', settings?.composio_platform === 'square' && !!settings?.composio_connection_id,
  'finalizeConnection() never ran — the vendor may have closed the tab before the redirect came back')

// ── 3. The borrowed token ───────────────────────────────────────────────────
console.log('\nToken')
let borrowed: string | null = null
try {
  borrowed = await getStoreAccessToken(MEMBER, 'square')
  check('Composio hands back an access_token', !!borrowed,
    'connection not OAUTH2/ACTIVE, or Composio withholds credentials on this plan — bookings then need a pasted token')
  if (borrowed) console.log(`      ${borrowed.length} chars, starts "${borrowed.slice(0, 4)}…"`)
} catch (e) {
  check('Composio hands back an access_token', false, describe(e))
}

const creds = await sq.getSquareCreds(MEMBER)
check('bookings resolve credentials', !!creds,
  'both sources empty, or bookings were switched off (square_bookings_off)')
if (creds) {
  const source = borrowed && creds.token === borrowed ? 'borrowed from the catalog connection' : 'pasted into vendor_secrets'
  console.log(`      source: ${source}; env=${creds.env}; location=${creds.locationId ?? 'unresolved'}`)
  if (!creds.locationId) note('no location id — availability search will return no slots until one is picked')
}

// ── 4. What the scopes actually buy ─────────────────────────────────────────
if (creds) {
  console.log('\nSquare API')

  try {
    const locations = await sq.listLocations(creds)
    check(`locations readable (${locations.length})`, locations.length > 0, 'MERCHANT_PROFILE_READ missing, or the account has none')
    for (const l of locations.slice(0, 5)) console.log(`      ${l.id}  ${l.name}`)
  } catch (e) {
    check('locations readable', false, describe(e))
  }

  let services: Awaited<ReturnType<typeof sq.listBookableServices>> = []
  try {
    services = await sq.listBookableServices(creds)
    check('bookable services readable', true)
    if (services.length === 0) {
      note('no service variation is marked bookable in Square — the Book button can never offer a slot until one is')
    }
    for (const s of services.slice(0, 5)) console.log(`      ${s.variationId}  ${s.name} (${s.durationMinutes}m)`)
  } catch (e) {
    check('bookable services readable', false, describe(e))
  }

  if (services.length > 0 && creds.locationId) {
    try {
      const start = new Date()
      const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000)
      const slots = await sq.searchAvailability(creds, {
        serviceVariationId: services[0].variationId,
        startAt: start.toISOString(),
        endAt: end.toISOString(),
      })
      check(`availability search works (${slots.length} slots in 7 days)`, Array.isArray(slots))
      if (slots.length === 0) {
        note('no open slots — real if their calendar is full or no team member is bookable, so not a failure on its own')
      }
    } catch (e) {
      check('availability search works', false, describe(e))
    }
  }
}

// ── 5. Catalog sync ─────────────────────────────────────────────────────────
console.log('\nCatalog')
try {
  const data = await runTool(TOOL_SLUGS.square.list, MEMBER, { types: 'ITEM,IMAGE' })
  const objects = (data as { objects?: unknown[] }).objects
  check(`${TOOL_SLUGS.square.list} runs`, true)
  console.log(`      ${Array.isArray(objects) ? objects.length : 0} catalog objects returned`)
} catch (e) {
  check(`${TOOL_SLUGS.square.list} runs`, false, describe(e))
}

const { count } = await db
  .from('products')
  .select('id', { count: 'exact', head: true })
  .eq('member_id', MEMBER)
console.log(`      ${count ?? 0} products in our DB for this member`)
if (!count) note('nothing synced yet — hit Sync Now, or wait for the 3am sweep')

// ORDERS_WRITE is checked as a scope above and deliberately not exercised:
// proving it means creating a real order in the vendor's Square.
note('ORDERS_WRITE not exercised — it would put a real order in their Square. Scope presence is checked above.')

console.log(`\n${pass} passed, ${fail} failed, ${warn} to look at`)
process.exit(fail === 0 ? 0 : 1)
