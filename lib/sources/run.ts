// The runner: dispatch to an adapter, apply the source's rules, report honestly.
//
// Everything shared across sources lives here — exclusion, past-date handling,
// dedupe, sorting — so an adapter only has to know how to read its own site.

import { requests, resetRequests } from './fetch'
import { geocodeVenues, keyFor, venueQuery, inBayArea } from './geo'
import { SOURCES } from './registry'
import { scrapeTribe } from './adapters/tribe'
import { scrapeLuma } from './adapters/luma'
import { scrapeSquarespace } from './adapters/squarespace'
import { scrapeDrupalIcs } from './adapters/drupal-ics'
import { scrapeJsonLd } from './adapters/jsonld'
import { scrapeLocalist } from './adapters/localist'
import { scrapeCtykit } from './adapters/recipe'
import type { RunReport, ScrapedEvent, SourceDef } from './types'

const ADAPTERS = {
  'wp-tribe': scrapeTribe,
  luma: scrapeLuma,
  squarespace: scrapeSquarespace,
  'drupal-ics': scrapeDrupalIcs,
  'json-ld': scrapeJsonLd,
  localist: scrapeLocalist,
  recipe: scrapeCtykit,
} as const

const today = () => new Date().toISOString().slice(0, 10)

/**
 * An event is live if it has not finished. Multi-day events (exhibitions) are
 * judged on their END date — filtering on the start would silently drop every
 * currently-running exhibition, which is exactly the bug this guards against.
 */
function isCurrent(e: ScrapedEvent, from: string): boolean {
  return (e.endDate ?? e.date) >= from
}

function excluded(e: ScrapedEvent, src: SourceDef): boolean {
  if (src.excludeTitle?.some((rx) => rx.test(e.title))) return true
  if (src.excludeTags?.length) {
    const tags = e.tags.map((t) => t.toLowerCase())
    if (src.excludeTags.some((x) => tags.some((t) => t.startsWith(x.toLowerCase())))) return true
  }
  return false
}

export interface SourceResult {
  report: RunReport
  events: ScrapedEvent[]
}

export async function runSource(src: SourceDef): Promise<SourceResult> {
  const started = Date.now()
  resetRequests()
  const base: RunReport = {
    sourceId: src.id, label: src.label, pattern: src.pattern,
    ok: false, pulled: 0, kept: 0, excluded: 0, seconds: 0, requests: 0,
  }

  try {
    const raw = await ADAPTERS[src.pattern](src)
    const from = today()

    const seen = new Set<string>()
    let dropped = 0
    const kept: ScrapedEvent[] = []
    for (const e of raw) {
      if (!e.title || !e.date) continue
      if (!isCurrent(e, from)) continue
      if (excluded(e, src)) {
        dropped++
        continue
      }
      // Dedupe on the source's stable id — never on ordinal position, because
      // some listings serve the same row on two pages (see scraping.md).
      if (seen.has(e.uid)) continue
      seen.add(e.uid)
      kept.push(e)
    }

    kept.sort((a, b) => (a.date + (a.start ?? '')).localeCompare(b.date + (b.start ?? '')))
    const limited = src.limit ? kept.slice(0, src.limit) : kept

    // Drift check. Compared against PULLED, not KEPT, so that a legitimately
    // quiet week (everything in the past) is not mistaken for a broken parser —
    // only "the site stopped giving us rows" trips this.
    const below =
      src.expectAtLeast != null && raw.length < src.expectAtLeast
        ? { expected: src.expectAtLeast, got: raw.length }
        : undefined

    return {
      report: { ...base, ok: !below, pulled: raw.length, kept: limited.length, excluded: dropped,
                seconds: +((Date.now() - started) / 1000).toFixed(1), requests: requests(),
                belowBaseline: below,
                error: below
                  ? `returned ${raw.length} events, expected at least ${src.expectAtLeast} — the source may have changed`
                  : undefined },
      events: limited,
    }
  } catch (err) {
    return {
      report: { ...base, ok: false, seconds: +((Date.now() - started) / 1000).toFixed(1),
                requests: requests(), error: err instanceof Error ? err.message : String(err) },
      events: [],
    }
  }
}

/**
 * Give every event a pin, cheapest source of truth first.
 *
 * Runs once over the whole batch rather than per source, so a venue shared by
 * two sources is looked up once. Events that cannot be placed keep `lat: null`
 * — we never guess a location, because a wrong pin is worse than no pin: the
 * proximity filter would confidently show it to the wrong person.
 */
export async function locate(
  events: ScrapedEvent[],
  opts: { useGoogle?: boolean; log?: (s: string) => void } = {}
): Promise<{ located: number; geocoded: number }> {
  const bySource = new Map(SOURCES.map((s) => [s.id, s]))

  // Tier 0: validate coordinates the adapters supplied. Native pins are exact
  // but not necessarily LOCAL — UCSF's calendar carries events as far out as
  // Olympic Valley, 180 miles away, which would otherwise sit in the data
  // claiming to be a San Francisco event.
  let outOfArea = 0
  for (const e of events) {
    if (e.lat != null && !inBayArea({ lat: e.lat, lng: e.lng! })) {
      e.lat = null
      e.lng = null
      e.geoVia = null
      outOfArea++
    }
  }
  if (outOfArea) opts.log?.(`  dropped ${outOfArea} pins outside the Bay Area`)

  // Some "venues" are not places at all. Pinning an online talk or a bookmobile
  // to a building would put it in a proximity search it has no business being in.
  const PLACELESS = /^(virtual|online|zoom|webinar|bookmobile|mobile outreach|tbd|various)/i
  const isPlaceless = (e: ScrapedEvent) =>
    PLACELESS.test(e.venue ?? '') || PLACELESS.test(e.location ?? '')

  // Tier 2: a single-site source's own coordinates, for events with no venue of
  // their own. Fort Mason publishes 162 events with a blank venue field, and
  // they really are all on one campus.
  //
  // Deliberately NOT applied when the event DID name a venue we failed to
  // resolve: SFPL's Potrero and Richmond branches would land on the Main
  // Library, which is a confidently wrong pin several miles from the truth.
  for (const e of events) {
    if (e.lat != null || isPlaceless(e)) continue
    const d = bySource.get(e.sourceId)?.defaultLatLng
    if (d && !e.venue) {
      e.lat = d.lat
      e.lng = d.lng
      e.geoVia = 'source'
    }
  }

  // Tier 3: geocode the remaining distinct venue strings, once each.
  const needs = events.filter((e) => e.lat == null && !isPlaceless(e))
  const queries = new Map<string, string>() // cacheKey → query
  for (const e of needs) {
    const src = bySource.get(e.sourceId)
    const q = venueQuery(e, src?.venueTemplate, src?.venueAliases)
    if (q) queries.set(keyFor(q), q)
  }

  const cache = await geocodeVenues([...queries.values()], opts)

  let geocoded = 0
  for (const e of needs) {
    const src = bySource.get(e.sourceId)
    const q = venueQuery(e, src?.venueTemplate, src?.venueAliases)
    const hit = q ? cache[keyFor(q)] : undefined
    if (hit?.lat != null && hit.lng != null && inBayArea({ lat: hit.lat, lng: hit.lng })) {
      e.lat = hit.lat
      e.lng = hit.lng
      e.geoVia = hit.via === 'google' ? 'google' : 'nominatim'
      geocoded++
    }
    // No fallback on failure — an unresolved venue stays unplaced. A missing pin
    // is honest; a wrong one silently corrupts every proximity search.
  }

  return { located: events.filter((e) => e.lat != null).length, geocoded }
}

export interface RunAllResult {
  scrapedAt: string
  reports: RunReport[]
  events: ScrapedEvent[]
  located?: number
}

/** Run every source (or a subset by id). Sources run sequentially so one slow
 *  site cannot starve the others' connection pool, and so per-source request
 *  counts stay attributable. */
export async function runAll(
  ids?: string[],
  opts: { geo?: boolean; useGoogle?: boolean; log?: (s: string) => void } = {}
): Promise<RunAllResult> {
  const targets = ids?.length ? SOURCES.filter((s) => ids.includes(s.id)) : SOURCES
  const reports: RunReport[] = []
  const events: ScrapedEvent[] = []

  for (const src of targets) {
    const { report, events: evs } = await runSource(src)
    reports.push(report)
    events.push(...evs)
  }

  // Cross-source dedupe: the same event can be listed by a venue AND an
  // aggregator (Funcheap lists plenty that Downtown SF also carries).
  const seen = new Set<string>()
  const merged = events.filter((e) => {
    const key = `${e.date}|${e.title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 40)}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  merged.sort((a, b) => (a.date + (a.start ?? '')).localeCompare(b.date + (b.start ?? '')))

  let located = merged.filter((e) => e.lat != null).length
  if (opts.geo !== false) {
    ;({ located } = await locate(merged, { useGoogle: opts.useGoogle, log: opts.log }))
  }

  return { scrapedAt: new Date().toISOString(), reports, events: merged, located }
}
