// Minimal iCalendar (RFC 5545) reader — just enough for event feeds.
// Deliberately dependency-free: the full ICS spec is large, but event calendars
// use a small, stable subset.

export interface VEvent {
  uid?: string
  summary?: string
  description?: string
  location?: string
  url?: string
  dtstart?: string
  dtend?: string
  class?: string
  rrule?: string
  /** True when DTSTART carried VALUE=DATE (an all-day event, no time). */
  allDay?: boolean
  /** IANA zone from TZID, when present. */
  tzid?: string
}

/** Undo RFC 5545 line folding: a CRLF followed by a space/tab continues the line. */
function unfold(s: string): string {
  return s.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '')
}

/** ICS escapes commas, semicolons and newlines inside TEXT values. */
function unescapeText(v: string): string {
  return v
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
}

export function parseIcs(raw: string): VEvent[] {
  const body = unfold(raw)
  const out: VEvent[] = []
  const blocks = body.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g) ?? []

  for (const block of blocks) {
    const ev: VEvent = {}
    for (const line of block.split(/\r?\n/)) {
      const idx = line.indexOf(':')
      if (idx < 0) continue
      const rawKey = line.slice(0, idx)
      const value = line.slice(idx + 1).trim()
      const [name, ...params] = rawKey.split(';')
      const key = name.trim().toUpperCase()

      switch (key) {
        case 'UID':
          ev.uid = value
          break
        case 'SUMMARY':
          ev.summary = unescapeText(value)
          break
        case 'DESCRIPTION':
          ev.description = unescapeText(value)
          break
        case 'LOCATION':
          ev.location = unescapeText(value)
          break
        case 'URL':
          ev.url = value
          break
        case 'CLASS':
          ev.class = value
          break
        case 'RRULE':
          ev.rrule = value
          break
        case 'DTSTART':
        case 'DTEND': {
          const tz = params.find((p) => p.toUpperCase().startsWith('TZID='))
          if (tz) ev.tzid = tz.slice(5)
          if (params.some((p) => p.toUpperCase() === 'VALUE=DATE')) ev.allDay = true
          if (key === 'DTSTART') ev.dtstart = value
          else ev.dtend = value
          break
        }
      }
    }
    if (ev.dtstart) out.push(ev)
  }
  return out
}

/**
 * Split an ICS timestamp into date + time.
 *
 * Feeds are inconsistent: `20260802` (all-day), `20260802T140000` (floating or
 * TZID-qualified), `20260802T210000Z` (UTC). We return the wall-clock values as
 * written plus whether they were UTC, and let the caller localise — an adapter
 * knows its source's timezone, this parser does not.
 */
export function splitStamp(stamp?: string): {
  date: string | null
  time: string | null
  utc: boolean
} {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(stamp ?? '')
  if (!m) return { date: null, time: null, utc: false }
  const [, y, mo, d, hh, mi, , z] = m
  return {
    date: `${y}-${mo}-${d}`,
    time: hh ? `${hh}:${mi}` : null,
    utc: Boolean(z),
  }
}

/** Shift a wall-clock date/time by whole hours (used to bring UTC into local). */
export function shiftHours(
  date: string,
  time: string | null,
  hours: number
): { date: string; time: string | null } {
  if (!time) return { date, time }
  const [y, mo, d] = date.split('-').map(Number)
  const [hh, mi] = time.split(':').map(Number)
  const t = new Date(Date.UTC(y, mo - 1, d, hh + hours, mi))
  return {
    date: t.toISOString().slice(0, 10),
    time: t.toISOString().slice(11, 16),
  }
}
