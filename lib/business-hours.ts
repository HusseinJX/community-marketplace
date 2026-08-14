// Reading a business's opening hours well enough to say "Open until 8pm".
//
// ── The rule this module is built around ─────────────────────────────────────
// A WRONG answer here sends someone across the city to a locked door. So every
// ambiguity returns `null`, and `null` renders as nothing rather than as a
// guess. We would rather say less than be confidently wrong about whether a
// place is open right now.
//
// `MemberProfile.businessHours` is a free-text string with no agreed shape — it
// comes from Google listings, from onboarding transcripts, and from vendors
// typing whatever they like. Two formats are common enough to be worth parsing:
//
//   "Mon-Fri: 9AM-6PM, Sat: 10AM-4PM"          (ranges, comma-separated)
//   "Monday: 9:00 AM – 5:00 PM\nTuesday: …"    (one line per day, Google's)
//
// Anything else — "by appointment", "varies", "24/7", "Open late Thursdays" —
// is not parsed. That is the intended outcome, not a gap to be filled later:
// each new format admitted is a new way to be wrong.
//
// Times are read in the CITY's timezone, never the viewer's — same reason
// lib/sf-date.ts exists. A visitor in London looking at a San Francisco bakery
// wants to know if it is open in San Francisco.

import { sfToday, sfMinutesNow } from "@/lib/sf-date";

/**
 * Day of week (0 = Sunday) in the CITY's timezone.
 *
 * Built from `sfToday()`'s `YYYY-MM-DD` rather than `new Date().getDay()`,
 * which would answer for the server's clock. Parsed at noon UTC so no timezone
 * offset can push the date onto the neighbouring day — the same trap
 * `toISOString().slice(0,10)` sets, documented in sf-date.ts.
 */
function cityWeekday(): number {
  const [y, m, d] = sfToday().split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay();
}

export type HoursStatus = {
  open: boolean;
  /** "Open until 8pm" / "Closed · opens 9am Tue" — ready to render. */
  label: string;
};

/** Minutes since midnight, or null if this isn't a time we're sure about. */
function parseTime(raw: string): number | null {
  const m = raw
    .trim()
    .toLowerCase()
    .match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?$/);
  if (!m) return null;

  let hour = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  const mer = m[3]?.replace(/\./g, "");

  if (hour > 24 || min > 59) return null;

  if (mer === "am") {
    if (hour > 12) return null;
    if (hour === 12) hour = 0;
  } else if (mer === "pm") {
    if (hour > 12) return null;
    if (hour !== 12) hour += 12;
  } else {
    // No am/pm. Only trust it when it's unambiguous 24-hour ("18:30").
    // A bare "9-5" could be 9am-5pm or 9pm-5am and we will not guess.
    if (!m[2]) return null;
    if (hour > 23) return null;
  }
  return hour * 60 + min;
}

const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const DAY_LABEL = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Day index for a token like "mon" / "monday" / "tues", or null. */
function parseDay(raw: string): number | null {
  const t = raw.trim().toLowerCase().slice(0, 3);
  const i = DAYS.indexOf(t);
  return i === -1 ? null : i;
}

/** Expand "mon-fri" / "sat" into day indices. Null if either end is unknown. */
function parseDaySpan(raw: string): number[] | null {
  const parts = raw.split(/[–—-]/);
  if (parts.length === 1) {
    const d = parseDay(parts[0]);
    return d === null ? null : [d];
  }
  if (parts.length !== 2) return null;
  const a = parseDay(parts[0]);
  const b = parseDay(parts[1]);
  if (a === null || b === null) return null;
  const out: number[] = [];
  // Wraps around the week ("sat-sun", "fri-mon").
  for (let i = a; ; i = (i + 1) % 7) {
    out.push(i);
    if (i === b) break;
    if (out.length > 7) return null;
  }
  return out;
}

type Interval = { open: number; close: number };

/**
 * Parse the whole string into per-day intervals.
 * Returns null the moment anything doesn't parse — a partially-understood
 * schedule is the dangerous case, because the days we failed to read look
 * exactly like days the business is closed.
 */
function parseSchedule(raw: string): Map<number, Interval[]> | null {
  if (!raw || raw.length > 400) return null;
  const lower = raw.toLowerCase();

  // Bail on anything that signals a schedule we can't represent.
  if (/appointment|varies|seasonal|call |closed today|24\s*\/\s*7|24 hours/.test(lower)) {
    return null;
  }

  const byDay = new Map<number, Interval[]>();
  // Split on newlines, semicolons and commas — but NOT on commas inside a time
  // range, which is why the day part is required before a colon below.
  const chunks = raw
    .split(/[\n;]+|,(?=\s*[A-Za-z])/)
    .map((c) => c.trim())
    .filter(Boolean);

  if (chunks.length === 0) return null;

  for (const chunk of chunks) {
    // The colon is optional — "Mon-Fri 9AM-6PM" is as unambiguous as
    // "Mon-Fri: 9AM-6PM" and common enough to be worth admitting. Safety comes
    // from the day span having to parse, not from the punctuation: "Open late
    // Thursdays" fails at parseDay("ope") and takes the whole string down.
    const m = chunk.match(/^([A-Za-z–—\s-]+?)\s*:\s*(.+)$/) ?? chunk.match(/^([A-Za-z]+(?:\s*[–—-]\s*[A-Za-z]+)?)\s+(\d.+)$/);
    if (!m) return null;

    const days = parseDaySpan(m[1]);
    if (!days) return null;

    const body = m[2].trim();
    if (/^closed$/i.test(body)) {
      for (const d of days) byDay.set(d, []);
      continue;
    }

    const times = body.split(/[–—]|-|\bto\b/).map((s) => s.trim());
    if (times.length !== 2) return null;
    const open = parseTime(times[0]);
    const close = parseTime(times[1]);
    if (open === null || close === null) return null;

    for (const d of days) {
      const list = byDay.get(d) ?? [];
      list.push({ open, close });
      byDay.set(d, list);
    }
  }

  return byDay.size > 0 ? byDay : null;
}

function fmt(mins: number): string {
  const h24 = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  const mer = h24 >= 12 ? "pm" : "am";
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  return m === 0 ? `${h}${mer}` : `${h}:${String(m).padStart(2, "0")}${mer}`;
}

/**
 * "Open until 8pm" / "Closed · opens 9am Tue", or null when we can't say.
 *
 * Null is a perfectly good answer and callers must render nothing for it —
 * never a placeholder like "Hours unknown", which is noise on every card of a
 * business that simply typed its hours in prose.
 */
export function hoursStatus(businessHours?: string | null): HoursStatus | null {
  if (!businessHours) return null;
  const schedule = parseSchedule(businessHours);
  if (!schedule) return null;

  const today = cityWeekday();
  const minutes = sfMinutesNow();

  // Open right now? Check today, plus yesterday's intervals that run past
  // midnight (a bar open "Fri: 8pm-2am" is still open at 1am on Saturday).
  for (const [day, offset] of [
    [today, 0],
    [(today + 6) % 7, 24 * 60],
  ] as const) {
    for (const iv of schedule.get(day) ?? []) {
      const close = iv.close <= iv.open ? iv.close + 24 * 60 : iv.close;
      const open = iv.open;
      const at = minutes + offset;
      if (at >= open && at < close) {
        return { open: true, label: `Open until ${fmt(iv.close)}` };
      }
    }
  }

  // Closed. Find the next opening within a week so the label is useful rather
  // than just negative — "Closed" alone tells nobody when to come back.
  for (let ahead = 0; ahead < 8; ahead++) {
    const day = (today + ahead) % 7;
    for (const iv of (schedule.get(day) ?? []).slice().sort((a, b) => a.open - b.open)) {
      if (ahead === 0 && iv.open <= minutes) continue;
      const when = ahead === 0 ? "" : ahead === 1 ? " tomorrow" : ` ${DAY_LABEL[day]}`;
      return { open: false, label: `Closed · opens ${fmt(iv.open)}${when}` };
    }
  }

  return { open: false, label: "Closed" };
}
