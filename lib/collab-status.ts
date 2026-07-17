import type { CollaborationSummary } from './collab-network'

// A collaboration is in one of two states. That's the whole vocabulary:
//
//   Planning ──▶ Active
//
// Planning = still coming together. Active = you and at least one other business
// are in, so it's real and moving. That's the same threshold the app already
// uses to let the event be created, so the chip and the Create-event button
// always agree.
//
// What's deliberately NOT a state:
//   · "Waiting on 2" — a collaboration is never blocked by people who haven't
//     replied. It goes ahead with whoever's in. Pending invitees are a detail on
//     the roster line, never the headline.
//   · "Confirm you're in" / "Event scheduled" — jargon about our internal
//     plumbing (the room roster's agreed flag, whether a vendor_events row
//     exists). Neither is the state of the collaboration. Whether you've pressed
//     "I'm in 👍" lives in the room where the button is; the event lives on the
//     Event link right there on the card.
//
// Derived, never stored — every input already exists. One function, so the
// dashboard's Active collabs card and the Collaborations tab can't drift apart.

export type CollabStatusKey = 'planning' | 'active'

export interface CollabStatus {
  key: CollabStatusKey
  label: string
}

/** Colour lives on the STATUS, not the card — one chip per state, nothing else
 *  tinted. (A whole card washed amber reads as an error; the card is fine, it's
 *  the state that needs a word and a colour.) */
export const STATUS_CLASS: Record<CollabStatusKey, string> = {
  planning: 'bg-stone-100 text-stone-500',
  active: 'bg-emerald-50 text-emerald-700',
}

export function collabStatus(c: CollaborationSummary): CollabStatus {
  // An event exists, or you're in with at least one other business → it's real.
  const active = !!c.eventId || c.agreedCount >= 2
  return active ? { key: 'active', label: 'Active' } : { key: 'planning', label: 'Planning' }
}

/** When it's happening, as a sortable number. Infinity = no date yet, which
 *  sorts last (it can't be "about to happen" if nobody's set a day).
 *
 *  vendor_events.event_date is TEXT — the create-event form is a free-text
 *  field, so it holds anything from "2026-08-09" to "next saturday". We parse
 *  what parses and treat the rest as undated rather than guessing an order from
 *  a string we don't understand. */
export function collabWhen(c: CollaborationSummary): number {
  if (!c.eventDate) return Infinity
  const t = Date.parse(c.eventDate)
  return Number.isNaN(t) ? Infinity : t
}

/** The order for both lists: soonest first, then Active above Planning.
 *
 *  In practice the two rules agree — only a collaboration that made an event has
 *  a date, and making an event makes it Active — so this reads as "what's about
 *  to happen, then everything still being figured out". */
export function compareCollabs(a: CollaborationSummary, b: CollaborationSummary): number {
  const byWhen = collabWhen(a) - collabWhen(b)
  if (byWhen !== 0 && Number.isFinite(byWhen)) return byWhen
  const rank = (c: CollaborationSummary) => (collabStatus(c).key === 'active' ? 0 : 1)
  return rank(a) - rank(b)
}

/** "3 businesses · 1 invited" — who's in this collaboration.
 *
 *  Counts the room roster rather than accepted invites: a collaboration you
 *  JOINED has no invite rows to count (they're the owner's), which gave every
 *  joined collaboration a wrong "1 business". */
export function collabRoster(c: CollaborationSummary): string {
  const people = Math.max(1, c.memberCount) // you, at minimum
  const invited = c.members.filter((m) => m.status === 'pending').length
  const parts = [`${people} ${people === 1 ? 'business' : 'businesses'}`]
  if (invited > 0) parts.push(`${invited} invited`)
  return parts.join(' · ')
}

// When and where get a line each. All three on one line clipped the venue name
// off the end of every card on a phone ("Aug 9, 2026 · 9:00 AM – 2:00 PM · Miss…")
// — and where it's happening is not a footnote to when.
//
// Both are null until the event exists: a collaboration in Planning has no time
// and nowhere to be yet, and printing "TBD" twice on every card is noise.
//
// Shown as stored: these are TEXT columns (see collabWhen), so reformatting
// would mean re-guessing what an unparseable string meant. New events come from
// a real date picker, so they read as ISO.

/** "Aug 9, 2026 · 9:00 AM – 2:00 PM" */
export function collabWhenLabel(c: CollaborationSummary): string | null {
  const parts = [c.eventDate, c.eventTime].filter((p) => p && String(p).trim())
  return parts.length > 0 ? parts.join(' · ') : null
}

/** "Mission Community Market" */
export function collabWhere(c: CollaborationSummary): string | null {
  const v = c.eventLocation?.trim()
  return v ? v : null
}

/** "19/7" — day/month, for the date under a card's event chip.
 *
 *  event_date is TEXT and arrives in three shapes: the date picker's ISO
 *  (2026-08-09), connector date strings, and free text an AI pulled off a flyer
 *  ("next saturday"). Unparseable text gets NO date rather than a wrong one — a
 *  chip that confidently shows the wrong day is worse than a chip with no day.
 *
 *  ISO is matched by hand instead of via Date.parse, which reads a date-only ISO
 *  string as UTC midnight: `new Date(Date.parse('2026-08-09')).getDate()` is the
 *  8th anywhere west of Greenwich, so every SF event would show a day early. */
export function collabEventDay(c: CollaborationSummary): string | null {
  const raw = c.eventDate?.trim()
  if (!raw) return null

  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(raw)
  if (iso) return `${Number(iso[3])}/${Number(iso[2])}`

  // Anything else (e.g. "Aug 9, 2026") parses in LOCAL time, so the calendar
  // fields are already the ones the member meant.
  const t = Date.parse(raw)
  if (Number.isNaN(t)) return null
  const d = new Date(t)
  return `${d.getDate()}/${d.getMonth() + 1}`
}
