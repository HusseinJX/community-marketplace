#!/usr/bin/env npx tsx
/**
 * Embed every scraped event, plus the interest presets, into data/embeddings.json.
 *
 *   npx tsx scripts/embed-events.ts
 *
 * Incremental: only events whose uid isn't already embedded cost anything, so a
 * weekly re-run after a scrape embeds just the new arrivals.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { embedAll, eventToText, EMBED_MODEL } from '../lib/reco/embed'
import { INTERESTS } from '../lib/reco/profile'
import type { ScrapedEvent } from '../lib/sources/types'

const EVENTS = join(process.cwd(), 'data', 'events.json')
const OUT = join(process.cwd(), 'data', 'embeddings.json')

interface Store {
  model: string
  events: Record<string, number[]>
  interests: Record<string, number[]>
  at: string
}

function load(): Store {
  try {
    const s = JSON.parse(readFileSync(OUT, 'utf8')) as Store
    // A model change invalidates everything — vectors from two models are not
    // comparable, and mixing them silently produces nonsense similarities.
    if (s.model === EMBED_MODEL) return s
    console.log(`model changed (${s.model} → ${EMBED_MODEL}); re-embedding all`)
  } catch {
    /* first run */
  }
  return { model: EMBED_MODEL, events: {}, interests: {}, at: '' }
}

async function main() {
  const { events } = JSON.parse(readFileSync(EVENTS, 'utf8')) as { events: ScrapedEvent[] }
  const store = load()

  const missingInterests = INTERESTS.filter((i) => !store.interests[i.id])
  if (missingInterests.length) {
    console.log(`embedding ${missingInterests.length} interest presets`)
    const vecs = await embedAll(missingInterests.map((i) => i.seed))
    missingInterests.forEach((i, n) => (store.interests[i.id] = vecs[n]))
  }

  const todo = events.filter((e) => !store.events[e.uid])
  console.log(
    `${events.length} events · ${events.length - todo.length} already embedded · ${todo.length} new`
  )

  if (todo.length) {
    const vecs = await embedAll(todo.map(eventToText), { log: (s) => console.log(s) })
    todo.forEach((e, n) => (store.events[e.uid] = vecs[n]))
  }

  // Drop vectors for events that have aged out, so the file doesn't grow forever.
  const live = new Set(events.map((e) => e.uid))
  let pruned = 0
  for (const uid of Object.keys(store.events)) {
    if (!live.has(uid)) {
      delete store.events[uid]
      pruned++
    }
  }

  store.at = new Date().toISOString()
  mkdirSync(join(process.cwd(), 'data'), { recursive: true })
  writeFileSync(OUT, JSON.stringify(store))

  const tokens = todo.reduce((a, e) => a + eventToText(e).length / 4, 0)
  console.log(
    `\nwrote ${Object.keys(store.events).length} event vectors ` +
    `(+${Object.keys(store.interests).length} interests), pruned ${pruned}`
  )
  console.log(`  new tokens ≈ ${Math.round(tokens)} → about $${((tokens / 1e6) * 0.02).toFixed(4)}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
