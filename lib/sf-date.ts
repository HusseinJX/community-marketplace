// Local time, for a product that is local.
//
// Every event in the feed happens in San Francisco and every date attached to
// one is Pacific. `new Date().toISOString().slice(0,10)` is UTC, and from 5pm
// Pacific onward that is ALREADY TOMORROW — so a feed filtered on "date >=
// today" quietly dropped this evening's events every single evening, at exactly
// the hour someone is most likely to be looking for something to do tonight.
//
// The timezone is fixed rather than read from the request because the events
// are fixed: a reader in London asking what is on tonight means tonight in San
// Francisco. When the app covers a second city this becomes a per-city value,
// not a per-viewer one.

export const CITY_TZ = 'America/Los_Angeles'

/** Date parts in the city's timezone, whatever the server's clock is set to. */
function cityParts(at: Date = new Date()): Record<string, string> {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: CITY_TZ,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(at)

  const out: Record<string, string> = {}
  for (const p of parts) if (p.type !== 'literal') out[p.type] = p.value
  return out
}

/** Today in the city, as `YYYY-MM-DD`. The only "today" the feed should use. */
export function sfToday(at: Date = new Date()): string {
  const p = cityParts(at)
  return `${p.year}-${p.month}-${p.day}`
}

/** Tomorrow in the city, as `YYYY-MM-DD`. */
export function sfTomorrow(at: Date = new Date()): string {
  return sfToday(new Date(at.getTime() + 864e5))
}

/** Minutes since midnight, in the city. `hour` is "24" at midnight under en-US. */
export function sfMinutesNow(at: Date = new Date()): number {
  const p = cityParts(at)
  const h = Number(p.hour) % 24
  return h * 60 + Number(p.minute)
}

/**
 * First clock time in a display string → minutes since midnight.
 *
 * `event_time` is free text built for reading ("1:00 PM – 2:30 PM", "All day",
 * "6:30 PM"), so this reads the start off the front and gives up otherwise.
 * Null means "no usable time", which the caller must treat as unknown rather
 * than as midnight.
 */
export function startMinutes(display: string | null): number | null {
  if (!display) return null

  const ampm = /(\d{1,2}):(\d{2})\s*(a\.?m\.?|p\.?m\.?)/i.exec(display)
  if (ampm) {
    let h = Number(ampm[1]) % 12
    if (/^p/i.test(ampm[3])) h += 12
    return h * 60 + Number(ampm[2])
  }

  // 24-hour fallback, for rows written before display formatting existed.
  const h24 = /^\s*(\d{1,2}):(\d{2})\b/.exec(display)
  if (h24) {
    const h = Number(h24[1])
    if (h > 23) return null
    return h * 60 + Number(h24[2])
  }

  return null
}

/**
 * The SECOND clock time in a display string → minutes since midnight.
 *
 * "1:00 PM – 2:30 PM" has an end; "6:30 PM" and "All day" do not. Null means we
 * genuinely don't know when it finishes, which is different from knowing it
 * runs all day, and the caller must not treat the two the same.
 *
 * Ends past midnight ("10:00 PM – 1:00 AM") come back SMALLER than the start;
 * callers compare against that rather than assuming a bigger number.
 */
export function endMinutes(display: string | null): number | null {
  if (!display) return null
  const times = [...display.matchAll(/(\d{1,2}):(\d{2})\s*(a\.?m\.?|p\.?m\.?)?/gi)]
  if (times.length < 2) return null
  const t = times[1]
  let h = Number(t[1])
  if (t[3]) {
    h = h % 12
    if (/^p/i.test(t[3])) h += 12
  }
  if (h > 23) return null
  return h * 60 + Number(t[2])
}

/**
 * Is it happening RIGHT NOW?
 *
 * Uses the end time when the source gave one, so a 30-minute talk that began
 * two hours ago is correctly over. Without an end time we fall back to a
 * three-hour window — long enough to cover most things, short enough that a
 * breakfast event is not still claimed to be "on" at dinner. A guess either way,
 * but bounded and stated.
 */
export function isOnNow(
  dateISO: string | null,
  timeDisplay: string | null,
  at: Date = new Date()
): boolean {
  if (!dateISO || dateISO !== sfToday(at)) return false
  const start = startMinutes(timeDisplay)
  if (start == null) return false

  const now = sfMinutesNow(at)
  if (now < start) return false

  const end = endMinutes(timeDisplay)
  if (end == null) return now - start <= 180
  // An end before the start means it runs past midnight, so it is still on.
  return end < start ? true : now < end
}

/**
 * Has it definitively finished?
 *
 * Only true when the source GAVE an end time and that time has passed. An event
 * that started with no stated end returns false — not because it is still on,
 * but because we do not know, and "Ended" is a claim we would be inventing.
 */
export function hasEnded(
  dateISO: string | null,
  timeDisplay: string | null,
  at: Date = new Date()
): boolean {
  if (!dateISO || dateISO !== sfToday(at)) return false
  const start = startMinutes(timeDisplay)
  const end = endMinutes(timeDisplay)
  if (start == null || end == null) return false
  if (end < start) return false // runs past midnight
  return sfMinutesNow(at) >= end
}

/**
 * How long until an event starts, in minutes. Negative once it has begun.
 *
 * Only meaningful for today — a "in 3 hours" on a Saturday event read on a
 * Tuesday would be nonsense — so anything not dated today returns null.
 */
export function minutesUntil(
  dateISO: string | null,
  timeDisplay: string | null,
  at: Date = new Date()
): number | null {
  if (!dateISO || dateISO !== sfToday(at)) return null
  const start = startMinutes(timeDisplay)
  if (start == null) return null
  return start - sfMinutesNow(at)
}
