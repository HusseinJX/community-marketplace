// The shopper's stored taste — read and written server-side only.
//
// `lib/reco/profile.ts` defines WHAT a taste profile is (chips with seed text,
// free prose, and how the two become one string). This file is where that
// lives, gets embedded, and comes back.

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { embedOne, toPgVector, EMBED_MODEL } from './embed'
import { profileToText, INTERESTS, type ShopperProfile } from './profile'

let _client: SupabaseClient | null = null
function db(): SupabaseClient {
  if (_client) return _client
  const url = process.env.SUPABASE_URL
  // Service-role ONLY. `shopper_taste` has no anon grant on purpose: these rows
  // hold what people told us about their children, their money and their
  // loneliness, and the anon key ships to every browser.
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set')
  _client = createClient(url, key)
  return _client
}

/** True when taste can be stored at all. Everything here no-ops without it. */
export const tasteConfigured = () =>
  !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY

export interface StoredTaste {
  subjectId: string
  interests: string[]
  about: string | null
  updatedAt: string | null
  /** Present only when a vector has actually been computed and stored. */
  hasVector: boolean
}

/**
 * Which row belongs to this reader.
 *
 * A Clerk id always wins over a device id, and the device id is never trusted
 * for a signed-in person: a client that could name its own subject could write
 * over a stranger's profile by guessing, and once signed in there is a real
 * identity to key on. For signed-out visitors the browser's own random id is
 * all there is, and that is fine — nothing here is worth stealing except by
 * someone who already has your device.
 */
export function subjectFor(clerkUserId: string | null, deviceId?: string | null): string | null {
  if (clerkUserId) return clerkUserId
  const raw = (deviceId ?? '').trim()
  // Shape-checked so a caller cannot pass a Clerk id and impersonate a person.
  if (!/^device:[A-Za-z0-9_-]{8,64}$/.test(raw)) return null
  return raw
}

const ROW = 'subject_id, interests, about, updated_at, embedding'

export async function getTaste(subjectId: string): Promise<StoredTaste | null> {
  if (!tasteConfigured()) return null
  const { data, error } = await db()
    .from('shopper_taste')
    .select(ROW)
    .eq('subject_id', subjectId)
    .maybeSingle()
  if (error || !data) return null
  return {
    subjectId: data.subject_id as string,
    interests: (data.interests as string[]) ?? [],
    about: (data.about as string | null) ?? null,
    updatedAt: (data.updated_at as string | null) ?? null,
    hasVector: !!data.embedding,
  }
}

/**
 * The stored query vector, ready to hand to `event_similarity`.
 *
 * Returned as pgvector's own text form rather than as numbers — it comes back
 * from PostgREST that way and goes straight back in that way, so there is no
 * parse/serialise round trip that could quietly lose precision.
 */
export async function tasteVector(subjectId: string): Promise<string | null> {
  if (!tasteConfigured()) return null
  const { data, error } = await db()
    .from('shopper_taste')
    .select('embedding, embed_model')
    .eq('subject_id', subjectId)
    .maybeSingle()
  if (error || !data?.embedding) return null
  // A vector from a different model is not comparable with the events' vectors.
  // Ignoring it degrades to keyword ranking, which is right — the alternative
  // is confident nonsense.
  if (data.embed_model && data.embed_model !== EMBED_MODEL) return null
  return data.embedding as string
}

/** Drop unknown chip ids rather than embedding a typo as if it meant something. */
const cleanInterests = (ids: string[]) =>
  [...new Set(ids)].filter((id) => INTERESTS.some((i) => i.id === id)).slice(0, 10)

export interface SaveResult extends StoredTaste {
  /** True when this save actually paid for an embedding. */
  embedded: boolean
}

/**
 * Write a profile, embedding it only when its text has actually changed.
 *
 * The comparison against `embedded_text` is what keeps this on the same rule as
 * the rest of the pipeline — the model runs once per new item. Re-saving an
 * unchanged profile, which the chat tuner does constantly as it edits one field
 * at a time, costs nothing.
 */
export async function saveTaste(
  subjectId: string,
  input: { interests?: string[]; about?: string | null }
): Promise<SaveResult | null> {
  if (!tasteConfigured()) return null

  const existing = await getTaste(subjectId)
  const interests = cleanInterests(input.interests ?? existing?.interests ?? [])
  const about =
    input.about === undefined
      ? (existing?.about ?? null)
      : (input.about ?? '').trim().slice(0, 2000) || null

  const profile: ShopperProfile = { interests, about: about ?? undefined }
  const text = profileToText(profile)

  const { data: prior } = await db()
    .from('shopper_taste')
    .select('embedded_text, embed_model')
    .eq('subject_id', subjectId)
    .maybeSingle()

  const unchanged =
    !!text && prior?.embedded_text === text && prior?.embed_model === EMBED_MODEL

  const row: Record<string, unknown> = {
    subject_id: subjectId,
    interests,
    about,
    updated_at: new Date().toISOString(),
  }

  let embedded = false
  if (!text) {
    // An emptied profile must CLEAR its vector, not keep the last one. Leaving
    // it would mean "forget me" visibly emptied the screen while the feed went
    // on being ranked by what they just deleted.
    row.embedding = null
    row.embedded_text = null
    row.embed_model = null
  } else if (!unchanged) {
    if (!process.env.OPENAI_API_KEY) return null
    row.embedding = toPgVector(await embedOne(text))
    row.embedded_text = text
    row.embed_model = EMBED_MODEL
    embedded = true
  }

  const { error } = await db().from('shopper_taste').upsert(row, { onConflict: 'subject_id' })
  if (error) throw new Error(`could not save taste: ${error.message}`)

  return {
    subjectId,
    interests,
    about,
    updatedAt: row.updated_at as string,
    hasVector: !!text,
    embedded,
  }
}

/** Forget everything stored about this person. */
export async function clearTaste(subjectId: string): Promise<void> {
  if (!tasteConfigured()) return
  await db().from('shopper_taste').delete().eq('subject_id', subjectId)
}
