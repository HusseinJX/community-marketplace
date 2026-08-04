// Give stored events their audience labels.
//
//   npx tsx scripts/label-events.ts --from-file   # replay data/audience.json ($0)
//   npx tsx scripts/label-events.ts               # label whatever is unlabelled
//   npx tsx scripts/label-events.ts --dry-run
//
// Two paths on purpose. 791 events were already labelled during the prototype
// and that work is on disk — replaying it costs nothing. Only events with no
// label go to the model, which is the rule the whole pipeline runs on: the
// model runs once per new item, never per request and never twice.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
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

import type { EventAudience } from '../lib/reco/audience'
import type { ScrapedEvent } from '../lib/sources/types'

const args = process.argv.slice(2)
const has = (f: string) => args.includes(f)
const dryRun = has('--dry-run')
const fromFile = has('--from-file')

/** How many events go to the model in one call. Matches the prototype's batching. */
const BATCH = 25

async function main() {
  if (!process.env.SUPABASE_URL) throw new Error('SUPABASE_URL not set')

  const { persistAudience, unlabelledScraped } = await import('../lib/sources/persist')

  const pending = await unlabelledScraped()
  console.log(`${pending.length} events have no audience label`)
  if (!pending.length) return

  type Labelled = EventAudience & { sourceId: string; uid: string }
  const out: Record<string, Labelled> = {}

  if (fromFile) {
    // Keyed on the BARE uid, which is what the prototype wrote. Most adapters
    // already build the source into the uid ("fortmason:10005694"); SFPL's is
    // an ICS UID that doesn't ("112306@sfpl.org"). Prefixing the source again
    // here matched nothing at all — the uid is the whole key.
    const path = join(process.cwd(), 'data', 'audience.json')
    const cached = JSON.parse(readFileSync(path, 'utf8')) as Record<string, EventAudience>
    let hit = 0
    for (const r of pending) {
      const label = cached[r.external_uid!]
      if (!label) continue
      out[r.external_uid!] = { ...label, sourceId: r.source_id!, uid: r.external_uid! }
      hit++
    }
    console.log(`  matched ${hit} from data/audience.json (no model, $0)`)
    console.log(`  ${pending.length - hit} still unlabelled — re-run without --from-file to label them`)
  } else {
    const { extractEventAudience } = await import('../lib/reco/audience')
    if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not set — needed to label')

    // The labeller reads ScrapedEvent, so rows are shaped back into one. Only
    // the fields eventBrief() actually uses need to be real.
    const asScraped = (r: (typeof pending)[number]): ScrapedEvent => ({
      uid: r.external_uid!, sourceId: r.source_id!, sourceLabel: '', title: r.title,
      date: '', endDate: null, start: r.event_time, end: null,
      venue: r.location, location: r.location, description: r.description,
      url: '', imageUrl: null, access: 'unknown', tags: r.tags ?? [],
      free: r.free, lat: null, lng: null, geoVia: null, neighborhood: null,
    })

    for (let i = 0; i < pending.length; i += BATCH) {
      const chunk = pending.slice(i, i + BATCH)
      process.stdout.write(`  labelling ${i + 1}–${Math.min(i + BATCH, pending.length)}… `)
      try {
        const labels = await extractEventAudience(chunk.map(asScraped))
        let n = 0
        for (const r of chunk) {
          const l = labels[r.external_uid!]
          if (!l) continue
          out[`${r.source_id}:${r.external_uid}`] = { ...l, sourceId: r.source_id!, uid: r.external_uid! }
          n++
        }
        console.log(`${n}/${chunk.length}`)
      } catch (e) {
        // One bad batch should not cost the whole run — the rest still label,
        // and a re-run picks up whatever is still missing.
        console.log(`failed: ${e instanceof Error ? e.message : e}`)
      }
    }
  }

  const n = Object.keys(out).length
  console.log(`\n${n} labels ready`)
  if (!n) return

  const sample = Object.values(out)[0]
  console.log(`  sample: topics=${sample.topics.join(',')} energy=${sample.energy} "${sample.idealAudience}"`)

  if (dryRun) {
    console.log('\n--dry-run: nothing written.')
    return
  }

  const res = await persistAudience(out, { log: (s) => console.log(s) })
  console.log(`  written ${res.updated}, failed ${res.failed}`)

  const left = await unlabelledScraped()
  console.log(`  still unlabelled: ${left.length}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
