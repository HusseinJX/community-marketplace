// Curated "what's on" fixtures — real games/events a venue is likely to be
// showing right now or soon. This is the tappable shortcut layer above the raw
// LIVE_EVENTS picklist: a vendor taps a matchup that's happening and the
// composer pre-fills (event + matchup + suggested teams), so going live is one
// tap instead of typing.
//
// Like lib/demo-live.ts, times are computed RELATIVE TO NOW so the strip always
// looks fresh and "live now" is always populated — no stale hardcoded dates.
// When a real sports-schedule feed exists (e.g. connector-agent ingest of
// today's slate), swap getFixtures() to read it; the shape + UI stay the same.

import { LIVE_EVENTS } from "@/lib/live-events";

export interface Fixture {
  id: string;
  event_slug: string;
  /** The matchup / headline, e.g. "Mexico vs Brazil". Goes into whats_on. */
  matchup: string;
  /** Optional team names to suggest for the "rooting for?" field. */
  teams?: string[];
  starts_at: string;
  ends_at: string;
  /**
   * True when the source (e.g. ESPN state="in") says the game is on right NOW —
   * authoritative over our estimated window, which can be too short (extra time,
   * stoppages) and wrongly mark a live game as ended.
   */
  live?: boolean;
}

// Offset (minutes from now) + length so each fixture's window floats with time.
interface FixtureSpec {
  event_slug: string;
  matchup: string;
  teams?: string[];
  /** Minutes from now the game kicks off (negative = already started). */
  startsInMin: number;
  /** How long the game runs. */
  lengthMin: number;
}

// Anchored to "now" so the slate always has live + upcoming entries. Ordered
// loosely by start time. Keep this curated; mirrors how LIVE_EVENTS is hand-kept.
const SLATE: FixtureSpec[] = [
  // Happening right now
  { event_slug: "liga-mx", matchup: "América vs Chivas", teams: ["América", "Chivas"], startsInMin: -35, lengthMin: 120 },
  { event_slug: "nba", matchup: "Lakers vs Celtics", teams: ["Lakers", "Celtics"], startsInMin: -50, lengthMin: 160 },
  { event_slug: "mlb", matchup: "Dodgers vs Giants", teams: ["Dodgers", "Giants"], startsInMin: -20, lengthMin: 180 },
  // Starting soon
  { event_slug: "la-liga", matchup: "Real Madrid vs Barcelona", teams: ["Real Madrid", "Barcelona"], startsInMin: 75, lengthMin: 120 },
  { event_slug: "ufc", matchup: "UFC 329: McGregor vs. Holloway 2", teams: ["McGregor", "Holloway"], startsInMin: 150, lengthMin: 300 },
  { event_slug: "champions-league", matchup: "Bayern vs PSG", teams: ["Bayern", "PSG"], startsInMin: 210, lengthMin: 120 },
  { event_slug: "mlb", matchup: "Yankees vs Red Sox", teams: ["Yankees", "Red Sox"], startsInMin: 320, lengthMin: 180 },
  // Later today / this week
  { event_slug: "f1", matchup: "British Grand Prix", startsInMin: 1080, lengthMin: 180 },
  { event_slug: "premier-league", matchup: "Arsenal vs Man City", teams: ["Arsenal", "Man City"], startsInMin: 1500, lengthMin: 120 },
  { event_slug: "boxing", matchup: "Championship Night", startsInMin: 2400, lengthMin: 240 },
];

const KNOWN_SLUGS = new Set(LIVE_EVENTS.map((e) => e.slug));

function build(spec: FixtureSpec, idx: number, now: number): Fixture {
  const start = now + spec.startsInMin * 60_000;
  return {
    id: `fx-${idx}-${spec.event_slug}`,
    event_slug: KNOWN_SLUGS.has(spec.event_slug) ? spec.event_slug : "other",
    matchup: spec.matchup,
    teams: spec.teams,
    starts_at: new Date(start).toISOString(),
    ends_at: new Date(start + spec.lengthMin * 60_000).toISOString(),
  };
}

/** All curated fixtures with windows floating relative to `now`. */
export function getFixtures(now: number = Date.now()): Fixture[] {
  return SLATE.map((s, i) => build(s, i, now)).sort(
    (a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at)
  );
}

/** True if the fixture is on now — the source's live flag wins over the window. */
export function isFixtureLive(f: Fixture, now: number = Date.now()): boolean {
  if (f.live === true) return true;
  if (f.live === false) return false;
  return Date.parse(f.starts_at) <= now && now < Date.parse(f.ends_at);
}

/** Split any fixture list into "live now" + upcoming, dropping ended ones. */
export function partitionFixtures(
  all: Fixture[],
  now: number = Date.now()
): { live: Fixture[]; upcoming: Fixture[] } {
  const sorted = [...all].sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
  return {
    live: sorted.filter((f) => isFixtureLive(f, now)),
    upcoming: sorted.filter((f) => Date.parse(f.starts_at) > now),
  };
}

/**
 * "Live now" first, then upcoming, from the curated fallback slate. Used when
 * the real fixtures API (see /api/fixtures) is unavailable so the strip still
 * populates.
 */
export function getLiveAndUpcoming(now: number = Date.now()): {
  live: Fixture[];
  upcoming: Fixture[];
} {
  return partitionFixtures(getFixtures(now), now);
}

/** Short "starts in" label, e.g. "in 25m" / "in 2h" / "Sat 7:00 PM". */
export function startsInLabel(startsAt: string, now: number = Date.now()): string {
  const ms = Date.parse(startsAt) - now;
  if (Number.isNaN(ms)) return "";
  if (ms <= 0) return "now";
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `in ${mins}m`;
  const hrs = mins / 60;
  if (hrs < 8) return `in ${Math.round(hrs)}h`;
  return new Date(startsAt).toLocaleString([], {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}
