// Curated picklist of "what's on" events a venue can broadcast, plus pure
// helpers for the live window + grouping. No Supabase import here so this stays
// trivially testable and safe to import on the client.

export interface LiveEvent {
  slug: string;
  label: string;
  emoji: string;
  /** Loose grouping for the picklist UI. */
  category: "Sports" | "Soccer" | "Combat" | "Motorsport" | "Culture" | "Other";
}

// Keep this list curated (the user chose a picklist over free-text). To add a
// known event, append here — `event_label` is denormalized onto each broadcast
// so renaming a label later won't orphan old rows.
//
// NB: label is "World Cup" (not "FIFA World Cup") — the "FIFA" wordmark is the
// trademark/affiliation signal Apple flags (5.2.1). "World Cup" is a plain event
// descriptor and stays generic across tournaments (men's, women's, etc.).
export const LIVE_EVENTS: LiveEvent[] = [
  { slug: "nba", label: "NBA", emoji: "🏀", category: "Sports" },
  { slug: "nfl", label: "NFL", emoji: "🏈", category: "Sports" },
  { slug: "mlb", label: "MLB", emoji: "⚾", category: "Sports" },
  { slug: "nhl", label: "NHL", emoji: "🏒", category: "Sports" },
  { slug: "college-football", label: "College Football", emoji: "🏈", category: "Sports" },
  { slug: "march-madness", label: "March Madness", emoji: "🏀", category: "Sports" },
  { slug: "world-cup", label: "World Cup", emoji: "🌍", category: "Soccer" },
  { slug: "champions-league", label: "Champions League", emoji: "⚽", category: "Soccer" },
  { slug: "premier-league", label: "Premier League", emoji: "⚽", category: "Soccer" },
  { slug: "la-liga", label: "La Liga", emoji: "⚽", category: "Soccer" },
  { slug: "liga-mx", label: "Liga MX", emoji: "⚽", category: "Soccer" },
  { slug: "soccer", label: "Soccer (other)", emoji: "⚽", category: "Soccer" },
  { slug: "ufc", label: "UFC / MMA", emoji: "🥊", category: "Combat" },
  { slug: "boxing", label: "Boxing", emoji: "🥊", category: "Combat" },
  { slug: "f1", label: "Formula 1", emoji: "🏎️", category: "Motorsport" },
  { slug: "nascar", label: "NASCAR", emoji: "🏁", category: "Motorsport" },
  { slug: "olympics", label: "Olympics", emoji: "🏅", category: "Sports" },
  { slug: "tennis", label: "Tennis", emoji: "🎾", category: "Sports" },
  { slug: "golf", label: "Golf", emoji: "⛳", category: "Sports" },
  { slug: "live-music", label: "Live Music", emoji: "🎶", category: "Culture" },
  { slug: "watch-party", label: "Watch Party", emoji: "📺", category: "Other" },
  { slug: "other", label: "Something Else", emoji: "✨", category: "Other" },
];

const EVENT_BY_SLUG: Record<string, LiveEvent> = Object.fromEntries(
  LIVE_EVENTS.map((e) => [e.slug, e])
);

export function eventBySlug(slug: string | null | undefined): LiveEvent | undefined {
  return slug ? EVENT_BY_SLUG[slug] : undefined;
}

/** Display label for a slug, falling back to a stored label or the raw slug. */
export function eventLabel(slug: string | null | undefined, fallback?: string | null): string {
  return eventBySlug(slug)?.label ?? fallback ?? slug ?? "Live";
}

export function eventEmoji(slug: string | null | undefined): string {
  return eventBySlug(slug)?.emoji ?? "📺";
}

// ── Pure live-window helpers (no DB) ───────────────────────────────────────────

export interface LiveWindow {
  starts_at: string;
  ends_at: string;
  active?: boolean;
}

/** Is this broadcast live at `now` (defaults to current time)? */
export function isLive(b: LiveWindow, now: number = Date.now()): boolean {
  if (b.active === false) return false;
  const start = Date.parse(b.starts_at);
  const end = Date.parse(b.ends_at);
  if (Number.isNaN(start) || Number.isNaN(end)) return false;
  return start <= now && now < end;
}

/** Human countdown until a broadcast ends, e.g. "2h 14m left" / "12m left". */
export function timeLeftLabel(endsAt: string, now: number = Date.now()): string {
  const ms = Date.parse(endsAt) - now;
  if (Number.isNaN(ms) || ms <= 0) return "ended";
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins}m left`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m left` : `${h}h left`;
}

/**
 * Group broadcasts by event_slug into featured lists, preserving the curated
 * LIVE_EVENTS order, then any unknown slugs alphabetically. Empty groups drop.
 */
export function groupByEvent<T extends { event_slug: string; event_label?: string | null }>(
  items: T[]
): { slug: string; label: string; emoji: string; items: T[] }[] {
  const buckets = new Map<string, T[]>();
  for (const it of items) {
    const arr = buckets.get(it.event_slug) ?? [];
    arr.push(it);
    buckets.set(it.event_slug, arr);
  }
  const order = LIVE_EVENTS.map((e) => e.slug);
  const slugs = [...buckets.keys()].sort((a, b) => {
    const ia = order.indexOf(a);
    const ib = order.indexOf(b);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.localeCompare(b);
  });
  return slugs.map((slug) => {
    const groupItems = buckets.get(slug)!;
    return {
      slug,
      label: eventLabel(slug, groupItems[0]?.event_label),
      emoji: eventEmoji(slug),
      items: groupItems,
    };
  });
}
