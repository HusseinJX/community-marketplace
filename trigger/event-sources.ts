// Recurring event sourcing.
//
// ONE sweep, not one cron per source. A single scheduled task ticks daily and
// runs whichever sources are due; adding a source is a registry entry (later, a
// DB row), never a new schedule. Nothing to keep in sync, no orphaned crons when
// a source is removed.
//
// Per-source cadence lives in `intervalDays` below. Weekly is the default —
// these calendars publish days-to-weeks ahead, so anything faster is wasted
// requests against someone else's server.

import { schedules, task, logger } from '@trigger.dev/sdk'
import { runAll, runSource, locate } from '@/lib/sources/run'
import { SOURCES, byId } from '@/lib/sources/registry'
import {
  persistScraped,
  pruneFinished,
  persistAudience,
  unlabelledScraped,
  unembeddedEvents,
  persistEmbeddings,
} from '@/lib/sources/persist'
import type { EventAudience } from '@/lib/reco/audience'
import type { ScrapedEvent } from '@/lib/sources/types'
// Registers the worker's global failure hook (no-op without SENTRY_DSN). Imported
// from every task file so the module is loaded whichever entrypoint runs first;
// ES module caching means it registers exactly once.
import './sentry'

/** How often each source is worth re-reading, in days. */
const INTERVAL_DAYS: Record<string, number> = {
  sfpl: 7,
  funcheap: 3, // curated daily; the highest-churn source we have
  fortmason: 7,
  ybgfestival: 14,
  gggp: 7,
  tiat: 7,
  somarts: 14,
  downtownsf: 7,
  lacocina: 14, // 3 upcoming events — freshness matters, volume doesn't
  ucsf: 7,
}

const DEFAULT_INTERVAL = 7

/**
 * Label whatever arrived without an audience.
 *
 * Runs after persistence, on NEW events only — the whole cost model depends on
 * this never re-labelling something already labelled (~$0.03/week for new
 * arrivals vs $0.11 for a full pass). Without it the personalised feed decays
 * quietly: fresh events keep appearing but carry no topics, so they can never
 * match what anyone asks for.
 *
 * No API key ⇒ skip and say so. Unlabelled events still show up in the
 * chronological feed; only personalisation is degraded, and a scrape that
 * succeeded should not be reported as failed because labelling could not run.
 */
async function labelNew(): Promise<{ labelled: number; pending: number; skipped?: string }> {
  const pending = await unlabelledScraped(400)
  if (!pending.length) return { labelled: 0, pending: 0 }

  if (!process.env.OPENAI_API_KEY) {
    logger.warn('OPENAI_API_KEY not set — new events left unlabelled', { pending: pending.length })
    return { labelled: 0, pending: pending.length, skipped: 'no OPENAI_API_KEY' }
  }

  const { extractEventAudience } = await import('@/lib/reco/audience')
  const out: Record<string, EventAudience & { sourceId: string; uid: string }> = {}
  const BATCH = 25

  for (let i = 0; i < pending.length; i += BATCH) {
    const chunk = pending.slice(i, i + BATCH)
    try {
      const labels = await extractEventAudience(
        chunk.map((r): ScrapedEvent => ({
          uid: r.external_uid!, sourceId: r.source_id!, sourceLabel: '', title: r.title,
          date: '', endDate: null, start: r.event_time, end: null,
          venue: r.location, location: r.location, description: r.description,
          url: '', imageUrl: null, access: 'unknown', tags: r.tags ?? [],
          free: r.free, lat: null, lng: null, geoVia: null, neighborhood: null,
        }))
      )
      for (const r of chunk) {
        const l = labels[r.external_uid!]
        if (l) out[r.external_uid!] = { ...l, sourceId: r.source_id!, uid: r.external_uid! }
      }
    } catch (err) {
      // One bad batch must not cost the rest; the next sweep retries whatever
      // is still unlabelled, because the query is "has no label" not "is new".
      logger.error('Labelling batch failed', {
        batch: i / BATCH, error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  const res = await persistAudience(out, { log: (s) => logger.info(s) })
  return { labelled: res.updated, pending: pending.length - res.updated }
}

/**
 * Embed whatever arrived without a vector.
 *
 * Same shape and same reasoning as labelNew(), and the same cost rule: only
 * events with no vector are paid for, so a nightly sweep embeds the handful
 * that are new (fractions of a cent) rather than the whole table.
 *
 * Skipped without an API key, and a failure here is reported but never thrown.
 * An unembedded event still appears in the feed and still ranks — on literal
 * word overlap instead of meaning — so this degrades personalisation rather
 * than breaking it, and a scrape that worked must not be reported as failed
 * because embedding could not run.
 */
async function embedNew(): Promise<{ embedded: number; pending: number; skipped?: string }> {
  const { EMBED_MODEL, embedAll, eventToText, toPgVector } = await import('@/lib/reco/embed')

  const pending = await unembeddedEvents(500, EMBED_MODEL)
  if (!pending.length) return { embedded: 0, pending: 0 }

  if (!process.env.OPENAI_API_KEY) {
    logger.warn('OPENAI_API_KEY not set — new events left unembedded', { pending: pending.length })
    return { embedded: 0, pending: pending.length, skipped: 'no OPENAI_API_KEY' }
  }

  try {
    const vecs = await embedAll(
      pending.map((r) =>
        eventToText({
          title: r.title,
          tags: r.tags ?? [],
          venue: r.location,
          neighborhood: r.neighborhood,
          description: r.description,
        })
      )
    )
    const res = await persistEmbeddings(
      pending.map((r, n) => ({ id: r.id, embedding: toPgVector(vecs[n]) })),
      EMBED_MODEL,
      { log: (s) => logger.info(s) }
    )
    return { embedded: res.updated, pending: pending.length - res.updated }
  } catch (err) {
    logger.error('Embedding failed', { error: err instanceof Error ? err.message : String(err) })
    return { embedded: 0, pending: pending.length, skipped: 'embedding error' }
  }
}

/** Scrape one source on demand — the "Run now" button and the confirm-time first run. */
export const scrapeEventSourceTask = task({
  id: 'scrape-event-source',
  run: async (payload: { sourceId: string }) => {
    const src = byId(payload.sourceId)
    if (!src) throw new Error(`Unknown source: ${payload.sourceId}`)

    const { report, events } = await runSource(src)
    logger.info('Source scraped', { ...report })
    if (!report.ok) throw new Error(report.error ?? 'scrape failed')

    // A source that returns rows but keeps none is indistinguishable from a
    // quiet week unless we say so explicitly.
    if (report.pulled > 0 && report.kept === 0) {
      logger.warn('All events dropped — check the window and exclusion rules', {
        sourceId: src.id, pulled: report.pulled, excluded: report.excluded,
      })
    }

    // Geocode before writing: an event with no pin is invisible to proximity
    // search, and this is the only moment we hold the whole batch.
    await locate(events, { useGoogle: true, log: (s) => logger.info(s) })

    const result = await persistScraped(events, { log: (s) => logger.info(s) })
    if (result.failed) {
      logger.error('Some events failed to persist', { ...result })
    }

    const labels = await labelNew()
    logger.info('Labelling done', { ...labels })

    // Both report a `pending`, so they are not spread together — a collision
    // would silently report one subsystem's backlog as the other's.
    const embeds = await embedNew()
    logger.info('Embedding done', { ...embeds })

    return { ...report, ...result, ...labels, embedded: embeds.embedded, embedPending: embeds.pending }
  },
})

/**
 * Daily sweep. Runs every source whose interval has elapsed.
 *
 * Daily rather than hourly on purpose: with weekly intervals, an hourly tick
 * would be 720 no-op runs a month to gain a scheduling precision nobody can
 * perceive. "Run now" covers urgency.
 */
export const sweepEventSourcesTask = schedules.task({
  id: 'sweep-event-sources',
  cron: '0 9 * * *', // 09:00 UTC — early morning Pacific, before the feed is read
  run: async (_payload, { ctx }) => {
    const dayIndex = Math.floor(Date.now() / 864e5)

    // Without a `next_run_at` column yet, stagger deterministically off the day
    // number so each source lands on its own cadence and they don't all fire
    // together. This whole block becomes a `WHERE next_run_at <= now()` query
    // once event_sources exists.
    const due = SOURCES.filter((s) => {
      const every = INTERVAL_DAYS[s.id] ?? DEFAULT_INTERVAL
      const offset = [...s.id].reduce((a, c) => a + c.charCodeAt(0), 0) % every
      return (dayIndex + offset) % every === 0
    })

    logger.info('Sweep starting', { runId: ctx.run.id, due: due.map((s) => s.id) })

    // Pruning is not conditional on anything being due. Events finish on their
    // own schedule, so a day with no source to re-read is still a day with
    // yesterday's events to clear out.
    const pruned = await pruneFinished({ log: (s) => logger.info(s) })

    if (!due.length) return { due: 0, kept: 0, written: 0, pruned, failed: 0 }

    const { reports, events } = await runAll(due.map((s) => s.id), {
      useGoogle: true,
      log: (s) => logger.info(s),
    })
    const failed = reports.filter((r) => !r.ok)
    for (const f of failed) logger.error('Source failed', { sourceId: f.sourceId, error: f.error })

    const result = await persistScraped(events, { log: (s) => logger.info(s) })
    if (result.failed) logger.error('Some events failed to persist', { ...result })

    const labels = await labelNew()
    const embeds = await embedNew()

    const summary = {
      due: due.length, kept: events.length, pruned, ...result, ...labels,
      embedded: embeds.embedded, embedPending: embeds.pending, failed: failed.length,
    }
    logger.info('Sweep complete', summary)
    return summary
  },
})
