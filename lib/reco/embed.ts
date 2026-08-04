// Embeddings for semantic event recommendation.
//
// `text-embedding-3-small` at $0.02 / 1M tokens: embedding all 796 events costs
// roughly a fifth of a cent, and re-embedding only happens for events we have
// not seen before. Cost is not a design constraint here — correctness is.
//
// Storage today is a JSON file (data/embeddings.json) so this can be developed
// and demonstrated without a migration. The production home is Supabase
// pgvector, which is the stated direction for this app's matching (see the
// connector-consolidation note in CLAUDE.md) — the shape below maps 1:1 onto a
// `vector(1536)` column.

import { getOpenAI } from '@/lib/openai'
import type { ScrapedEvent } from '@/lib/sources/types'

export const EMBED_MODEL = process.env.OPENAI_EMBED_MODEL || 'text-embedding-3-small'
export const EMBED_DIMS = 1536

/**
 * What we actually embed for an event.
 *
 * Title first and repeated, because it is the densest signal — descriptions are
 * often boilerplate ("This program is sponsored by Friends of the Library…")
 * that would otherwise drag every library event toward the same point in space.
 */
export function eventToText(e: ScrapedEvent): string {
  const parts = [
    e.title,
    e.title,
    e.tags.join(', '),
    e.venue ?? '',
    e.neighborhood ?? '',
    (e.description ?? '').slice(0, 500),
  ]
  return parts.filter(Boolean).join('. ').slice(0, 2000)
}

/** Embed a batch of strings. The API accepts arrays, so this is one call per chunk. */
export async function embedAll(
  texts: string[],
  opts: { chunk?: number; log?: (s: string) => void } = {}
): Promise<number[][]> {
  const chunk = opts.chunk ?? 128
  const out: number[][] = []
  for (let i = 0; i < texts.length; i += chunk) {
    const slice = texts.slice(i, i + chunk)
    const res = await getOpenAI().embeddings.create({
      model: EMBED_MODEL,
      input: slice,
    })
    // The API guarantees order, but sort by index rather than trusting it —
    // a silently misaligned batch would attach every event to someone else's
    // vector, which is invisible until the recommendations look "sort of odd".
    const sorted = [...res.data].sort((a, b) => a.index - b.index)
    out.push(...sorted.map((d) => d.embedding))
    opts.log?.(`  embedded ${Math.min(i + chunk, texts.length)}/${texts.length}`)
  }
  return out
}

export async function embedOne(text: string): Promise<number[]> {
  const [v] = await embedAll([text])
  return v
}

/**
 * Cosine similarity. OpenAI returns unit-normalised vectors, so this is really
 * a dot product — but normalising defensively costs nothing and means a
 * hand-built or cached vector can't silently skew every score.
 */
export function cosine(a: number[], b: number[]): number {
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  if (!na || !nb) return 0
  return dot / (Math.sqrt(na) * Math.sqrt(nb))
}
