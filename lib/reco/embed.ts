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
export function eventToText(
  // Structural, not `ScrapedEvent`, so a database row can produce the SAME text
  // as the scrape did. If the two ever diverged, a backfilled vector and a
  // freshly-ingested one would describe the same event differently — and
  // nothing would report it, because both are valid vectors.
  e: Pick<ScrapedEvent, 'title' | 'tags' | 'venue' | 'neighborhood' | 'description'>
): string {
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
 * Weighted blend of two vectors, re-normalised.
 *
 * Used when someone with a saved profile also types a sentence. Both describe
 * what they want, over different timespans, and the sentence wins: what you
 * asked for thirty seconds ago is a better guide than what you told us in
 * March. Blending rather than replacing is what stops "anything tonight?" from
 * throwing away everything the profile knows — the vegetarian with a toddler
 * is still a vegetarian with a toddler.
 *
 * Re-normalising matters: the sum of two unit vectors is not a unit vector, and
 * cosine against an un-normalised query silently compresses every score toward
 * zero, which reads as "the recommender stopped being confident".
 */
export function blend(a: number[], b: number[], weightA = 0.7): number[] {
  const out = a.map((x, i) => x * weightA + (b[i] ?? 0) * (1 - weightA))
  const norm = Math.sqrt(out.reduce((s, x) => s + x * x, 0))
  return norm ? out.map((x) => x / norm) : out
}

/**
 * Serialise a vector the way pgvector's input parser expects: `[0.1,0.2,…]`.
 *
 * Sent as a STRING rather than a JSON array on purpose. PostgREST maps a JSON
 * array onto an array column, not onto `vector`, so passing `number[]` fails at
 * the boundary with a type error that reads like a schema problem. A string is
 * cast by pgvector itself, which is also where a wrong dimension gets caught.
 */
export function toPgVector(v: number[]): string {
  return `[${v.join(',')}]`
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
