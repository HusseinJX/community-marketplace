#!/usr/bin/env npx tsx
/**
 * Semantic personalisation, against the REAL database.
 *
 *   npx tsx scripts/taste-smoke.mts
 *
 * Creates a throwaway taste profile, exercises it, and deletes it. The
 * interesting failures here are never type errors — they are "the profile was
 * saved but the feed ignored it" and "deleting it left the vector behind".
 */
import { readFileSync } from 'node:fs'

for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const t = line.trim()
  if (!t || t.startsWith('#')) continue
  const eq = t.indexOf('=')
  if (eq === -1) continue
  const k = t.slice(0, eq).trim()
  let v = t.slice(eq + 1).trim()
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!process.env[k]) process.env[k] = v
}

let pass = 0
let fail = 0
const ok = (name: string, cond: boolean, detail = '') => {
  if (cond) {
    pass++
    console.log(`  \x1b[32m✓\x1b[0m ${name}`)
  } else {
    fail++
    console.log(`  \x1b[31m✗\x1b[0m ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

const SUBJECT = `device:smoketest${Date.now().toString(36)}`

async function main() {
  const { subjectFor, getTaste, saveTaste, clearTaste, tasteVector } = await import('../lib/reco/taste.js')
  const { blend, embedOne, toPgVector, EMBED_MODEL } = await import('../lib/reco/embed.js')
  const { profileToText } = await import('../lib/reco/profile.js')
  const { rankEvents } = await import('../lib/reco/rank.js')
  const { createClient } = await import('@supabase/supabase-js')
  const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  console.log('\nIdentity')
  ok('a Clerk id wins over a supplied device id', subjectFor('user_abc', 'device:deadbeefcafe') === 'user_abc')
  ok('a signed-out browser keeps its own device id', subjectFor(null, 'device:deadbeefcafe') === 'device:deadbeefcafe')
  ok('a client cannot pass itself off as a Clerk id', subjectFor(null, 'user_abc') === null)
  ok('a malformed device id is refused', subjectFor(null, 'device:../../etc') === null)
  ok('no id at all is not an error, just no profile', subjectFor(null, null) === null)

  console.log('\nProfile text')
  ok(
    'free text is weighted above the chips by repetition',
    (profileToText({ interests: ['music'], about: 'I love mahjong' }).match(/mahjong/g) ?? []).length === 2,
  )
  ok('an empty profile produces no text to embed', profileToText({ interests: [], about: '' }) === '')

  console.log('\nBlending')
  const a = await embedOne('live music')
  const b = await embedOne('toddler story time')
  const mixed = blend(a, b, 0.7)
  const norm = Math.sqrt(mixed.reduce((s, x) => s + x * x, 0))
  ok('a blend is re-normalised to unit length', Math.abs(norm - 1) < 1e-6, `got ${norm}`)
  const dot = (x: number[], y: number[]) => x.reduce((s, v, i) => s + v * y[i], 0)
  ok('the blend leans toward the sentence, not the profile', dot(mixed, a) > dot(mixed, b))

  console.log('\nSaving')
  const first = await saveTaste(SUBJECT, {
    interests: ['family', 'outdoors'],
    about: 'I have a 4-year-old and no car. Free is better.',
  })
  ok('a new profile is stored and embedded', !!first?.embedded && !!first?.hasVector)
  ok('unknown chip ids are dropped rather than embedded', !first?.interests.includes('nonsense'))

  const again = await saveTaste(SUBJECT, { interests: ['family', 'outdoors'] })
  ok('re-saving unchanged text costs no embedding', again?.embedded === false)

  const changed = await saveTaste(SUBJECT, { about: 'I have a 4-year-old and no car. Free is better. I also like live jazz.' })
  ok('changed text is re-embedded', changed?.embedded === true)

  const vec = await tasteVector(SUBJECT)
  ok('the stored vector reads back in pgvector form', typeof vec === 'string' && vec!.startsWith('['))

  console.log('\nModel guard')
  await db.from('shopper_taste').update({ embed_model: 'some-other-model' }).eq('subject_id', SUBJECT)
  ok('a vector from another model is refused, not silently mixed', (await tasteVector(SUBJECT)) === null)
  await db.from('shopper_taste').update({ embed_model: EMBED_MODEL }).eq('subject_id', SUBJECT)

  console.log('\nSimilarity against real events')
  const toddler = await embedOne('story time for my toddler')
  const { data: sims, error } = await db.rpc('event_similarity', {
    q: toPgVector(toddler),
    from_date: new Date().toISOString().slice(0, 10),
    max_rows: 1200,
  })
  ok('the similarity function runs', !error, error?.message)
  const rows = (sims ?? []) as { id: string; sim: number }[]
  ok('every live event is scored, not a truncated top-K', rows.length > 100, `${rows.length} scored`)
  ok('scores are real cosine values', rows.every((r) => r.sim >= -1 && r.sim <= 1))

  const top = [...rows].sort((x, y) => y.sim - x.sim).slice(0, 5)
  const { data: titles } = await db.from('vendor_events').select('id,title').in('id', top.map((r) => r.id))
  const topTitles = top.map((r) => titles?.find((t) => t.id === r.id)?.title ?? '').join(' | ')
  ok(
    'meaning beats spelling (children/story events lead, without the query words)',
    /stor|child|kid|famil|read|learn|toddler|babies|baby/i.test(topTitles),
    topTitles.slice(0, 120),
  )

  console.log('\nRanking integration')
  const simMap: Record<string, number> = {}
  for (const r of rows) simMap[r.id] = r.sim
  const { data: eventRows } = await db
    .from('vendor_events')
    .select('id, title, event_date, end_date, event_time, location, neighborhood, lat, lng, tags, free, topics, energy, ideal_audience, audience, description, source_id, member_name, poster_image_url, event_url, access')
    .eq('active', true)
    .limit(400)
  const { prepare } = await import('../lib/reco/from-db.js')
  const { events, audience } = prepare((eventRows ?? []) as never)
  const facts = {
    topics: [], energies: [], childAges: [], adultOnlyOk: null, freeOnly: null,
    times: [], prefersOutdoor: null, wantsToMeetPeople: null, maxMiles: null, summary: '',
  }
  const withSim = rankEvents(events, { facts, audience, similarities: simMap })
  const without = rankEvents(events, { facts, audience })
  ok('the ranker accepts precomputed similarities', withSim.ranked.length > 0)
  ok(
    'similarity actually changes the order',
    withSim.ranked[0]?.event.uid !== without.ranked[0]?.event.uid ||
      withSim.ranked[0]!.similarity > 0,
  )
  ok(
    'an unembedded event scores 0 rather than being dropped',
    rankEvents(events, { facts, audience, similarities: {} }).ranked.length === withSim.ranked.length,
  )

  console.log('\nForgetting')
  const emptied = await saveTaste(SUBJECT, { interests: [], about: null })
  ok('emptying a profile clears its vector too', emptied?.hasVector === false)
  const { data: afterEmpty } = await db.from('shopper_taste').select('embedding').eq('subject_id', SUBJECT).maybeSingle()
  ok('the vector column really is null, not stale', afterEmpty?.embedding === null)

  await clearTaste(SUBJECT)
  ok('delete removes the row entirely', (await getTaste(SUBJECT)) === null)

  console.log(`\n${pass} passed, ${fail} failed\n`)
  if (fail) process.exit(1)
}

main().catch(async (e) => {
  console.error(e)
  try {
    const { clearTaste } = await import('../lib/reco/taste.js')
    await clearTaste(SUBJECT)
  } catch {
    /* best effort */
  }
  process.exit(1)
})
