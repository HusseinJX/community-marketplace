// Drupal event listings that expose a per-event .ics export (SFPL).
//
// The route: listing pages carry a `/quickview/{id}` link, and that same {id}
// is the calendar-export id — so detail pages are never fetched. This matters:
// an SFPL event page is 221KB of which almost all is site chrome (every branch
// address lives in the nav), while the .ics is 581 bytes of exact data with a
// stable UID and an explicit CLASS:PUBLIC.
//
// TWO TRAPS, both silent (see scraping.md):
//   1. `date-to` is EXCLUSIVE. Asking for 08/02–08/08 returns Aug 2–7 and drops
//      Saturday entirely — 49 events, with nothing in the response to hint at it.
//      We always request one day past the intended end.
//   2. Pagination is unstable: the same event can appear on two pages. Dedupe on
//      the id, never on ordinal position.

import { fetchText, pooled, toText } from '../fetch'
import { parseIcs, splitStamp, shiftHours } from '../ics'
import type { Access, ScrapedEvent, SourceDef } from '../types'

interface Card { id: string; url: string; venue: string | null; tags: string[]; imageUrl: string | null }

const rx = {
  card: /<article about="\/events\//g,
  quickview: /href="\/quickview\/(\d+)"/,
  venue: /location--short-label"[\s\S]*?field__item">([\s\S]*?)<\/div>/,
  topic: /topic_target_id=\d+"[^>]*>([^<]+)<\/a>/g,
  // Drupal renders each card's picture as style variants; the widest offered is
  // 620px, which is a thumbnail on a phone at 3x. The path tells us where the
  // ORIGINAL lives, so we take that instead — see originalFrom().
  image: /src="(\/sites\/default\/files\/styles\/[^"]+)"/,
  audience: /audience_target_id=\d+"[^>]*>([^<]+)<\/a>/g,
  total: /of ([\d,]+) results/,
}

/**
 * Drupal image-style URL → the original file.
 *
 * `/sites/default/files/styles/2_1_medium/public/2026-06/30356.png?h=…&itok=…`
 * becomes
 * `/sites/default/files/2026-06/30356.png`
 *
 * The style segment and the cache-busting query are the derivative; everything
 * after `public/` is the real path. Measured: the original is ~950x475 where the
 * widest offered variant is 620w and the one in `src` is 89w. `itok` is a
 * signature for the DERIVATIVE only, so dropping the query is required, not
 * merely tidy — keeping it on the original path 404s.
 *
 * Returns null rather than a guess if the URL isn't shaped like a style path,
 * so a Drupal change degrades to "no image" instead of a broken one.
 */
function originalFrom(styled: string, base: string): string | null {
  const m = /^\/sites\/default\/files\/styles\/[^/]+\/public\/(.+)$/.exec(styled.split('?')[0])
  return m ? `${base}/sites/default/files/${m[1]}` : null
}

function usDate(d: Date): string {
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`
}

export async function scrapeDrupalIcs(src: SourceDef): Promise<ScrapedEvent[]> {
  const base = String(src.config.base).replace(/\/$/, '')
  const listPath = String(src.config.listPath ?? '/events')
  const icsPath = String(src.config.icsPath ?? '/sfpl-events/add-to-calendar')
  const perPage = Number(src.config.perPage ?? 50)
  const maxPages = Number(src.config.maxPages ?? 8)
  const days = src.windowDays ?? 14
  const utcOffset = Number(src.config.utcOffsetHours ?? -7)

  const from = new Date()
  // +1: `date-to` is exclusive — see trap 1 above.
  const to = new Date(Date.now() + (days + 1) * 864e5)

  const cards = new Map<string, Card>()
  let reported = 0

  for (let page = 0; page < maxPages; page++) {
    const url =
      `${base}${listPath}?date-from=${usDate(from)}&date-to=${usDate(to)}` +
      `&items_per_page=${perPage}&page=${page}`
    const html = await fetchText(url, { timeoutMs: 25_000 })
    if (page === 0) reported = Number(rx.total.exec(html)?.[1]?.replace(/,/g, '') ?? 0)

    const blocks = html.split('<article about="/events/').slice(1)
    if (!blocks.length) break

    for (const raw of blocks) {
      const block = raw.slice(0, 6000)
      const slug = block.slice(0, block.indexOf('"'))
      const id = rx.quickview.exec(block)?.[1]
      if (!id || cards.has(id)) continue // trap 2: dedupe on the id
      cards.set(id, {
        id,
        url: `${base}/events/${slug}`,
        venue: toText(rx.venue.exec(block)?.[1]) || null,
        imageUrl: (() => {
          const styled = rx.image.exec(block)?.[1]
          return styled ? originalFrom(styled, base) : null
        })(),
        tags: [
          ...[...block.matchAll(rx.topic)].map((m) => m[1]),
          ...[...block.matchAll(rx.audience)].map((m) => m[1]),
        ].map((t) => toText(t)),
      })
    }
    if (reported && cards.size >= reported) break
  }

  const list = [...cards.values()]
  const events = await pooled(list, async (c): Promise<ScrapedEvent | null> => {
    const ics = parseIcs(await fetchText(`${base}${icsPath}/${c.id}`, { timeoutMs: 18_000 }))[0]
    if (!ics?.summary) return null
    const s = splitStamp(ics.dtstart)
    const e = splitStamp(ics.dtend)
    if (!s.date) return null
    // The feed publishes UTC; bring it into the library's local day.
    const ls = s.utc ? shiftHours(s.date, s.time, utcOffset) : { date: s.date, time: s.time }
    const le = e.date && e.utc ? shiftHours(e.date, e.time, utcOffset) : { date: e.date, time: e.time }
    const cls = (ics.class ?? '').toLowerCase()
    const access: Access = cls === 'public' ? 'public' : cls ? 'private' : 'unknown'

    return {
      uid: ics.uid ?? `${src.id}:${c.id}`,
      sourceId: src.id,
      sourceLabel: src.label,
      title: ics.summary.trim(),
      date: ls.date,
      endDate: le.date && le.date !== ls.date ? le.date : null,
      start: ls.time,
      end: le.time,
      venue: c.venue,
      location: ics.location ?? null,
      description: toText(ics.description).slice(0, 400) || null,
      url: c.url,
      imageUrl: c.imageUrl,
      access,
      tags: c.tags,
      free: true, // library programmes are free by policy
      lat: null,
      lng: null,
      geoVia: null,
      neighborhood: null,
    }
  }, 6)

  return events.filter((e): e is ScrapedEvent => e !== null)
}
