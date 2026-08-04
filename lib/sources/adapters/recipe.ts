// Hand-written recipes — the tier-3 fallback for sites with no feed of any kind.
//
// This is the only adapter that can silently break when a site restyles, so
// every recipe declares expectations (`minEvents`) and the runner treats a
// violated expectation as a hard failure rather than "a quiet week".
//
// Currently: Downtown SF (ctykit CMS). The same recipe may port to other
// neighbourhood BIDs running ctykit.

import { fetchText, pooled, toText } from '../fetch'
import type { ScrapedEvent, SourceDef } from '../types'

const MONTHS: Record<string, number> = {
  Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6,
  Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12,
}

/**
 * Downtown SF prints either a single date ("Thursday, Aug 13, 2026") or a RANGE
 * ("Sat, Mar 21, 2026 - Sat, Sep 5, 2026") for exhibitions that run for months.
 * Note the weekday is spelled out in one form and abbreviated in the other, so
 * one pattern must tolerate both.
 *
 * Returning every date found is deliberate: the second one means the event is
 * ongoing, and filtering on the START date alone silently drops every currently
 * running exhibition.
 */
function parseDates(s: string): { date: string | null; endDate: string | null } {
  const found = [...s.matchAll(/(\w{3})\w*\s+(\d{1,2}),\s*(\d{4})/g)]
    .map((m) => {
      const mo = MONTHS[m[1]]
      return mo ? `${m[3]}-${String(mo).padStart(2, '0')}-${m[2].padStart(2, '0')}` : null
    })
    .filter((d): d is string => Boolean(d))
  return { date: found[0] ?? null, endDate: found[1] ?? null }
}

/** "6:30pm - 9pm" → 24h start/end. Empty for all-day events. */
function parseTimes(s: string): { start: string | null; end: string | null } {
  const parts = [...s.matchAll(/(\d{1,2})(?::(\d{2}))?\s*([ap])m/gi)].map((m) => {
    let h = Number(m[1]) % 12
    if (m[3].toLowerCase() === 'p') h += 12
    return `${String(h).padStart(2, '0')}:${m[2] ?? '00'}`
  })
  return { start: parts[0] ?? null, end: parts[1] ?? null }
}

export async function scrapeCtykit(src: SourceDef): Promise<ScrapedEvent[]> {
  const base = String(src.config.base).replace(/\/$/, '')
  const listPath = String(src.config.listPath ?? '/things-to-do/events')

  const listing = await fetchText(`${base}${listPath}`, { timeoutMs: 25_000 })

  // The listing is fully server-rendered; its date filters are client-side only,
  // so a single fetch returns the whole (~30 day) window with no pagination.
  const slugs = [...new Set(
    [...listing.matchAll(/<a class="evcard" href="([^"]+)"/g)].map((m) => m[1])
  )].filter((u) => u.startsWith(String(src.config.detailPrefix ?? '/do/')))

  const events = await pooled(slugs, async (slug): Promise<ScrapedEvent | null> => {
    const p = await fetchText(base + slug, { timeoutMs: 20_000, retries: 1 })
    const title = toText(/<h1>([\s\S]*?)<\/h1>/.exec(p)?.[1])
    if (!title) return null

    // The listing card omits the YEAR entirely ("Thu 13 Aug") — only the detail
    // page states it. A wrong year is a silently broken event, so we always come
    // here rather than inferring.
    const { date, endDate } = parseDates(toText(/class="dldate">([^<]+)</.exec(p)?.[1] ?? ''))
    if (!date) return null
    const { start, end } = parseTimes(toText(/class="dltime">([^<]*)</.exec(p)?.[1] ?? ''))

    const locBlock = /<h2 class="on-detail">Location<\/h2>([\s\S]*?)(?:<h2|<p><a[^>]*btn)/.exec(p)?.[1]
    const details = /<h2 class="on-detail">Details<\/h2>([\s\S]*?)(?:<h2 class="on-detail"|<\/div>\s*<\/div>\s*<\/div>)/.exec(p)?.[1]
    const loc = toText(locBlock)
    const img = /data-src="(https:\/\/img\.[^"]+)"/.exec(p)?.[1] ?? null

    return {
      uid: `${src.id}:${slug}`,
      sourceId: src.id,
      sourceLabel: src.label,
      title,
      date,
      endDate,
      start,
      end,
      venue: loc.split(',')[0] || null,
      location: loc || null,
      description: toText(details).slice(0, 400) || null,
      url: base + slug,
      imageUrl: img,
      access: 'unknown',
      tags: endDate ? ['Ongoing exhibition'] : [],
      free: null,
      lat: null,
      lng: null,
      geoVia: null,
      neighborhood: null,
    }
  }, 5)

  return events.filter((e): e is ScrapedEvent => e !== null)
}
