// Seed / refresh scraped events in Supabase.
//
//   npx tsx scripts/publish-events.ts --dry-run     # scrape + report, write nothing
//   npx tsx scripts/publish-events.ts --from-file   # reuse data/events.json ($0, no network)
//   npx tsx scripts/publish-events.ts               # fresh scrape, geocode, write
//   npx tsx scripts/publish-events.ts --only sfpl,funcheap
//   npx tsx scripts/publish-events.ts --hide      # PANIC: hide every scraped event
//   npx tsx scripts/publish-events.ts --show      # put them back
//
// The manual counterpart to the Trigger.dev sweep — same persistence path, run
// by hand so the first write to a live database is something a person watches.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

// Load .env.local the same way tests/setup-env.ts does — the repo has no
// dotenv dependency, and this script needs the real Supabase credentials.
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

import type { ScrapedEvent } from '../lib/sources/types'

const args = process.argv.slice(2)
const has = (f: string) => args.includes(f)
const val = (f: string) => {
  const i = args.indexOf(f)
  return i >= 0 ? args[i + 1] : undefined
}

const dryRun = has('--dry-run')
const fromFile = has('--from-file')
const only = val('--only')?.split(',').map((s) => s.trim()).filter(Boolean)

async function main() {
  if (!process.env.SUPABASE_URL) throw new Error('SUPABASE_URL not set — check .env.local')

  // Imported here, after env is loaded: persist.ts builds its Supabase client at
  // module scope, so a top-of-file import would evaluate it with no credentials.
  const { runAll } = await import('../lib/sources/run')
  const { persistScraped, pruneFinished, scrapedCounts, autoPublishes, setScrapedVisibility } =
    await import('../lib/sources/persist')

  // The kill switch runs alone — it touches no source and needs no scrape.
  if (has('--hide') || has('--show')) {
    const visible = has('--show')
    const n = await setScrapedVisibility(visible, { sourceId: val('--only') })
    console.log(`${visible ? 'Restored' : 'Hid'} ${n} scraped events.`)
    return
  }

  let events: ScrapedEvent[]

  if (fromFile) {
    const path = join(process.cwd(), 'data', 'events.json')
    const raw = JSON.parse(readFileSync(path, 'utf8'))
    events = (raw.events ?? raw) as ScrapedEvent[]
    console.log(`Loaded ${events.length} events from data/events.json (no network, no geocoding)`)
    // The file is a snapshot; anything that has since finished must not be
    // written as though it were upcoming.
    const today = new Date().toISOString().slice(0, 10)
    const before = events.length
    events = events.filter((e) => (e.endDate ?? e.date) >= today)
    if (before !== events.length) console.log(`  dropped ${before - events.length} that have already finished`)
  } else {
    console.log(`Scraping${only ? ` ${only.join(', ')}` : ' all sources'}…`)
    const res = await runAll(only, { useGoogle: true, log: (s) => console.log(s) })
    events = res.events
    for (const r of res.reports) {
      const flag = r.ok ? '  ' : '!!'
      console.log(`${flag} ${r.label.padEnd(38)} pulled ${String(r.pulled).padStart(4)}  kept ${String(r.kept).padStart(4)}  ${r.seconds}s${r.error ? `  — ${r.error}` : ''}`)
    }
    console.log(`\n${events.length} events, ${res.located} placed`)
  }

  if (only) events = events.filter((e) => only.includes(e.sourceId))

  // What would land, split by publish decision — the number worth reading
  // before writing to a live feed.
  const pub = events.filter((e) => autoPublishes(e.sourceId))
  const rev = events.filter((e) => !autoPublishes(e.sourceId))
  const placed = events.filter((e) => e.lat != null).length
  console.log(`\n  publish now : ${pub.length}`)
  console.log(`  for review  : ${rev.length}`)
  console.log(`  with a pin  : ${placed} / ${events.length}`)

  if (dryRun) {
    console.log('\n--dry-run: nothing written.')
    return
  }

  console.log('\nWriting…')
  const result = await persistScraped(events, { log: (s) => console.log(s) })
  console.log(`  written ${result.written}  (live ${result.published}, draft ${result.drafted})  failed ${result.failed}`)
  for (const e of result.errors) console.log(`  ! ${e}`)

  const pruned = await pruneFinished({ log: (s) => console.log(s) })
  if (pruned) console.log(`  pruned ${pruned} finished events`)

  console.log('\nIn the table now:')
  const counts = await scrapedCounts()
  for (const [id, c] of Object.entries(counts).sort()) {
    if (c.live || c.draft) console.log(`  ${id.padEnd(14)} live ${String(c.live).padStart(4)}   draft ${String(c.draft).padStart(3)}`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
