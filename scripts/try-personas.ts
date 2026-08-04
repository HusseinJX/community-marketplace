#!/usr/bin/env npx tsx
/**
 * Run the recommender over the scraped feed for a set of people.
 *
 *   npx tsx scripts/try-personas.ts                    # the built-in set
 *   npx tsx scripts/try-personas.ts "chill stuff nearby"
 *
 * Proves the whole chain end to end: free text → structured facts → hard
 * filters → ranked feed with fact-based reasons.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { extractPersona, type EventAudience } from '../lib/reco/audience'
import { embedOne } from '../lib/reco/embed'
import { rankEvents, diversify } from '../lib/reco/rank'
import type { ScrapedEvent } from '../lib/sources/types'

const ROOT = process.cwd()
const { events } = JSON.parse(readFileSync(join(ROOT, 'data/events.json'), 'utf8')) as {
  events: ScrapedEvent[]
}
const emb = JSON.parse(readFileSync(join(ROOT, 'data/embeddings.json'), 'utf8')) as {
  events: Record<string, number[]>
}
const audience = JSON.parse(readFileSync(join(ROOT, 'data/audience.json'), 'utf8')) as Record<
  string,
  EventAudience
>

/** Deliberately mixed phrasings — a want, a vibe, an identity, and a blend. */
const PEOPLE: { say: string; home: { lat: number; lng: number }; where: string }[] = [
  { say: 'i want more reading events', home: { lat: 37.7599, lng: -122.4148 }, where: 'Mission' },
  { say: 'something lively tonight', home: { lat: 37.7785, lng: -122.4056 }, where: 'SoMa' },
  { say: 'more tech events', home: { lat: 37.7785, lng: -122.4056 }, where: 'SoMa' },
  { say: 'chill stuff', home: { lat: 37.753, lng: -122.484 }, where: 'Sunset' },
  { say: 'I have a 4-year-old and no car. Free is better.', home: { lat: 37.7599, lng: -122.4148 }, where: 'Mission' },
  { say: "just moved here, broke, want to meet people at night", home: { lat: 37.7785, lng: -122.4056 }, where: 'SoMa' },
]

const B = (s: string) => `\x1b[1m${s}\x1b[0m`
const DIM = (s: string) => `\x1b[2m${s}\x1b[0m`

async function run(say: string, home: { lat: number; lng: number }, where: string) {
  const facts = await extractPersona(say)
  const vec = await embedOne(say)
  const { ranked, filtered } = rankEvents(events, {
    facts, profileVector: vec, vectors: emb.events, audience, home,
  })
  const feed = diversify(ranked)

  console.log(`\n${B(`“${say}”`)}  ${DIM(`· from ${where}`)}`)
  console.log(DIM(`   heard: ${facts.summary}`))
  console.log(DIM(
    `   facts: topics=[${facts.topics.join(', ')}] energies=[${facts.energies.join(', ')}]` +
    `${facts.childAges.length ? ` kids=[${facts.childAges}]` : ''}` +
    `${facts.freeOnly ? ' freeOnly' : ''}${facts.maxMiles ? ` ≤${facts.maxMiles}mi` : ''}` +
    `${facts.times.length ? ` times=[${facts.times}]` : ''}` +
    `${facts.wantsToMeetPeople ? ' wantsToMeetPeople' : ''}`
  ))
  const dropped = Object.entries(filtered).map(([k, v]) => `${v} ${k}`).join(', ')
  console.log(DIM(`   ${feed.length} eligible of ${events.length}${dropped ? ` · filtered out: ${dropped}` : ''}`))

  for (const r of feed.slice(0, 5)) {
    console.log(`   ${r.score.toFixed(3)}  ${r.event.title.slice(0, 56)}`)
    console.log(DIM(`          ${r.why.join(' · ')}`))
  }
  return { say, where, facts, feed: feed.slice(0, 30) }
}

async function main() {
  const custom = process.argv.slice(2).filter((a) => !a.startsWith('-')).join(' ')
  const people = custom
    ? [{ say: custom, home: { lat: 37.7749, lng: -122.4194 }, where: 'SF' }]
    : PEOPLE

  const out = []
  for (const p of people) out.push(await run(p.say, p.home, p.where))

  if (!custom) {
    writeFileSync(join(ROOT, 'data/personas.json'), JSON.stringify(out, null, 1))
    console.log(`\nwrote ${out.length} persona feeds → data/personas.json`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
