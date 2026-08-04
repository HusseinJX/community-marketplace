#!/usr/bin/env npx tsx
/**
 * Scrape every configured event source and write the result to data/events.json.
 *
 *   npx tsx scripts/scrape-events.ts              # all sources
 *   npx tsx scripts/scrape-events.ts sfpl funcheap  # just these
 *
 * This is the same `runAll()` the Trigger.dev task calls, so what you see
 * locally is what runs on a schedule.
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { runAll } from '../lib/sources/run'

const OUT = join(process.cwd(), 'data', 'events.json')

async function main() {
  const argv = process.argv.slice(2)
  const ids = argv.filter((a) => !a.startsWith('-'))
  // Geocoding is on by default but skippable (--no-geo) since the first run
  // walks Nominatim at 1 req/sec; afterwards it is served from data/venues.json.
  const geo = !argv.includes('--no-geo')
  // Google is used only where the free geocoder fails, and only once per
  // venue (see geo.ts). --no-google keeps a run strictly free.
  const useGoogle = !argv.includes('--no-google')
  console.log(ids.length ? `Scraping: ${ids.join(', ')}` : 'Scraping all sources…\n')

  const result = await runAll(ids, { geo, useGoogle, log: (m) => console.log(m) })

  const pad = (s: string, n: number) => s.padEnd(n).slice(0, n)
  console.log(
    `${pad('SOURCE', 32)} ${pad('PATTERN', 12)} ${'PULL'.padStart(5)} ${'KEPT'.padStart(5)} ` +
    `${'EXCL'.padStart(5)} ${'REQS'.padStart(5)} ${'SECS'.padStart(6)}`
  )
  console.log('─'.repeat(78))
  for (const r of result.reports) {
    // A source that pulled rows but kept none is the dangerous case: it looks
    // identical to "a quiet week" unless PULL and KEPT are shown side by side.
    const flag = !r.ok ? `  ✗ ${r.error}`
      : r.pulled > 0 && r.kept === 0 ? '  ← all dropped (past/excluded)'
      : r.pulled === 0 ? '  ← source returned nothing'
      : ''
    console.log(
      `${pad(r.label, 32)} ${pad(r.pattern, 12)} ${String(r.pulled).padStart(5)} ` +
      `${String(r.kept).padStart(5)} ${String(r.excluded).padStart(5)} ` +
      `${String(r.requests).padStart(5)} ${String(r.seconds).padStart(6)}${flag}`
    )
  }

  const ok = result.reports.filter((r) => r.ok).length
  const totalReq = result.reports.reduce((a, r) => a + r.requests, 0)
  const totalSec = result.reports.reduce((a, r) => a + r.seconds, 0)
  console.log('─'.repeat(78))
  console.log(
    `${pad(`${ok}/${result.reports.length} sources ok`, 51)} ` +
    `${String(result.events.length).padStart(6)} ${''.padStart(5)} ` +
    `${String(totalReq).padStart(5)} ${totalSec.toFixed(1).padStart(6)}`
  )

  mkdirSync(join(process.cwd(), 'data'), { recursive: true })
  writeFileSync(OUT, JSON.stringify(result, null, 1))
  console.log(`\nWrote ${result.events.length} events → data/events.json`)

  // Quality summary — the numbers worth watching run to run.
  const withDesc = result.events.filter((e) => e.description).length
  const known = result.events.filter((e) => e.access !== 'unknown').length
  const free = result.events.filter((e) => e.free === true).length
  const ongoing = result.events.filter((e) => e.endDate).length
  const placed = result.events.filter((e) => e.lat != null).length
  const viaNative = result.events.filter((e) => e.geoVia === 'native').length
  console.log(
    `  descriptions ${withDesc}/${result.events.length} · ` +
    `access stated ${known} · known-free ${free} · multi-day ${ongoing}`
  )
  console.log(
    `  located ${placed}/${result.events.length} ` +
    `(${viaNative} native · ${result.events.filter((e) => e.geoVia === 'nominatim').length} geocoded · ` +
    `${result.events.filter((e) => e.geoVia === 'source').length} source pin)`
  )
  if (result.reports.some((r) => !r.ok)) process.exitCode = 1
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
