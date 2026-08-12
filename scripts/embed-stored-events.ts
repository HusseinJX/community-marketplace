#!/usr/bin/env npx tsx
/**
 * Give stored events their embeddings.
 *
 *   npx tsx scripts/embed-stored-events.ts --from-file   # replay data/embeddings.json ($0)
 *   npx tsx scripts/embed-stored-events.ts               # embed whatever has no vector
 *   npx tsx scripts/embed-stored-events.ts --dry-run
 *
 * Two paths, for the same reason label-events.ts has two: 796 events were
 * already embedded during the prototype and that work is sitting on disk in
 * data/embeddings.json. Replaying it costs nothing. Only events with no vector
 * go to the API — the model runs once per new item, never twice.
 */
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

const args = process.argv.slice(2)
const has = (f: string) => args.includes(f)
const dryRun = has('--dry-run')
const fromFile = has('--from-file')

async function main() {
  if (!process.env.SUPABASE_URL) throw new Error('SUPABASE_URL not set')

  const { embedAll, eventToText, toPgVector, EMBED_MODEL } = await import('../lib/reco/embed')
  const { unembeddedEvents, persistEmbeddings } = await import('../lib/sources/persist')

  const pending = await unembeddedEvents(2000, EMBED_MODEL)
  console.log(`${pending.length} events have no ${EMBED_MODEL} vector`)
  if (!pending.length) return

  const out: { id: string; embedding: string }[] = []
  let replayed = 0
  const stillTodo: typeof pending = []

  if (fromFile) {
    // Keyed on the BARE uid, which is what the prototype wrote — the same key
    // shape audience.json uses. In-app events have no external_uid and can
    // never appear here, so they fall through to the API path below.
    let store: { model: string; events: Record<string, number[]> } | null = null
    try {
      store = JSON.parse(
        readFileSync(join(process.cwd(), 'data', 'embeddings.json'), 'utf8')
      ) as { model: string; events: Record<string, number[]> }
    } catch {
      console.warn('  no data/embeddings.json to replay')
    }
    // A vector from another model is not a saving, it is a corruption that
    // does not announce itself. Refuse the whole file rather than mix.
    if (store && store.model !== EMBED_MODEL) {
      console.warn(`  ignoring file: built with ${store.model}, we use ${EMBED_MODEL}`)
      store = null
    }
    for (const r of pending) {
      const v = r.external_uid ? store?.events[r.external_uid] : undefined
      if (v) {
        out.push({ id: r.id, embedding: toPgVector(v) })
        replayed++
      } else stillTodo.push(r)
    }
    console.log(`  replayed ${replayed} from file · ${stillTodo.length} still need the API`)
  } else {
    stillTodo.push(...pending)
  }

  if (stillTodo.length) {
    if (!process.env.OPENAI_API_KEY) {
      console.warn(`  OPENAI_API_KEY not set — leaving ${stillTodo.length} unembedded`)
    } else if (dryRun) {
      console.log(`  would embed ${stillTodo.length} via ${EMBED_MODEL}`)
    } else {
      const texts = stillTodo.map((r) =>
        eventToText({
          title: r.title,
          tags: r.tags ?? [],
          venue: r.location,
          neighborhood: r.neighborhood,
          description: r.description,
        })
      )
      const vecs = await embedAll(texts, { log: (s) => console.log(s) })
      stillTodo.forEach((r, n) => out.push({ id: r.id, embedding: toPgVector(vecs[n]) }))
      const tokens = texts.reduce((a, t) => a + t.length / 4, 0)
      console.log(`  embedded ${vecs.length} · about $${((tokens / 1e6) * 0.02).toFixed(4)}`)
    }
  }

  if (dryRun) {
    console.log(`\ndry run — would write ${out.length} vectors`)
    return
  }
  if (!out.length) return

  const res = await persistEmbeddings(out, EMBED_MODEL, { log: (s) => console.log(s) })
  console.log(`\nwrote ${res.updated} event vectors${res.failed ? `, ${res.failed} failed` : ''}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
