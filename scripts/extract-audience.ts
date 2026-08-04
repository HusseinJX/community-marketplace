#!/usr/bin/env npx tsx
/**
 * Label every scraped event with structured audience metadata.
 *
 *   npx tsx scripts/extract-audience.ts
 *
 * Incremental: only events without a label cost anything, so the weekly re-run
 * after a scrape labels just the new arrivals.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { extractEventAudience, type EventAudience } from '../lib/reco/audience'
import { pooled } from '../lib/sources/fetch'
import type { ScrapedEvent } from '../lib/sources/types'

const EVENTS = join(process.cwd(), 'data', 'events.json')
const OUT = join(process.cwd(), 'data', 'audience.json')
const BATCH = 10

async function main() {
  const { events } = JSON.parse(readFileSync(EVENTS, 'utf8')) as { events: ScrapedEvent[] }

  let store: Record<string, EventAudience> = {}
  try {
    store = JSON.parse(readFileSync(OUT, 'utf8')) as Record<string, EventAudience>
  } catch {
    /* first run */
  }

  const todo = events.filter((e) => !store[e.uid])
  console.log(`${events.length} events · ${events.length - todo.length} labelled · ${todo.length} new`)
  if (!todo.length) return

  const batches: ScrapedEvent[][] = []
  for (let i = 0; i < todo.length; i += BATCH) batches.push(todo.slice(i, i + BATCH))

  let done = 0
  const results = await pooled(batches, async (b) => {
    const r = await extractEventAudience(b)
    done += b.length
    if (done % 100 < BATCH) console.log(`  labelled ${done}/${todo.length}`)
    return r
  }, 5)

  let got = 0
  for (const r of results) {
    if (!r) continue
    Object.assign(store, r)
    got += Object.keys(r).length
  }

  // Prune labels for events that have aged out.
  const live = new Set(events.map((e) => e.uid))
  let pruned = 0
  for (const uid of Object.keys(store)) {
    if (!live.has(uid)) {
      delete store[uid]
      pruned++
    }
  }

  mkdirSync(join(process.cwd(), 'data'), { recursive: true })
  writeFileSync(OUT, JSON.stringify(store))

  const missed = todo.length - got
  console.log(`\nlabelled ${got}/${todo.length}${missed ? ` (${missed} missed)` : ''}, pruned ${pruned}`)
  console.log(`  total ${Object.keys(store).length} labels → data/audience.json`)

  // Coverage — how often the model actually committed rather than returning null.
  const all = Object.values(store)
  const pct = (n: number) => `${Math.round((n / all.length) * 100)}%`
  console.log(
    `  topics ${pct(all.filter((a) => a.topics?.length).length)} · ` +
    `energy ${pct(all.filter((a) => a.energy).length)} · ` +
    `kidsWelcome ${pct(all.filter((a) => a.kidsWelcome !== null).length)} · ` +
    `format ${pct(all.filter((a) => a.format).length)} · ` +
    `idealAudience ${pct(all.filter((a) => a.idealAudience).length)}`
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
