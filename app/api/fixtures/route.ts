import { NextResponse } from "next/server";
import type { Fixture } from "@/lib/live-fixtures";
import { getFixtures } from "@/lib/live-fixtures";

// Real "what's on right now" sports slate, fetched from ESPN's public scoreboard
// endpoints (no API key required). A vendor's "Go Live" composer reads this so
// they tap a real game instead of typing the matchup + time by hand.
//
// ESPN returns *today's* games per league with a live status (pre/in/post), so
// we can show what's actually on. If every league fetch fails we fall back to
// the curated slate in lib/live-fixtures so the picker is never empty.

export const revalidate = 60; // cache upstream for a minute; games move slowly

// ESPN sport-path + league-slug → our LIVE_EVENTS slug. Ordered roughly by how
// likely a US neighborhood venue is showing it. Add a league by appending here.
//   rangeDays — ESPN's scoreboard defaults to a single day; for sparse events
//   spread across a bracket/season (World Cup knockouts, weekly UFC cards) we
//   query a date RANGE so upcoming games show, not just today's.
interface LeagueSpec {
  sport: string;
  league: string;
  slug: string;
  rangeDays?: number;
}
const LEAGUES: LeagueSpec[] = [
  { sport: "soccer", league: "fifa.world", slug: "world-cup", rangeDays: 16 },
  { sport: "soccer", league: "fifa.friendly", slug: "soccer" },
  { sport: "soccer", league: "uefa.champions", slug: "champions-league", rangeDays: 16 },
  { sport: "soccer", league: "eng.1", slug: "premier-league", rangeDays: 10 },
  { sport: "soccer", league: "esp.1", slug: "la-liga", rangeDays: 10 },
  { sport: "soccer", league: "mex.1", slug: "liga-mx", rangeDays: 10 },
  { sport: "soccer", league: "usa.1", slug: "soccer" },
  { sport: "basketball", league: "nba", slug: "nba" },
  { sport: "football", league: "nfl", slug: "nfl", rangeDays: 10 },
  { sport: "football", league: "college-football", slug: "college-football", rangeDays: 10 },
  { sport: "baseball", league: "mlb", slug: "mlb" },
  { sport: "hockey", league: "nhl", slug: "nhl" },
  // Combat sports are event/card-based (one card per week), not team games —
  // parsed specially below (the event NAME is the matchup, e.g. "UFC 329:
  // McGregor vs. Holloway 2"; the top competitors are only the first prelim).
  { sport: "mma", league: "ufc", slug: "ufc", rangeDays: 21 },
  { sport: "mma", league: "pfl", slug: "ufc", rangeDays: 21 },
  { sport: "boxing", league: "boxing", slug: "boxing", rangeDays: 21 },
];

// Rough broadcast length per sport (minutes) so we can synthesize an end time —
// ESPN's scoreboard doesn't give one. Used only to decide "still live-ish".
const LENGTH_MIN: Record<string, number> = {
  soccer: 130,
  basketball: 160,
  football: 210,
  baseball: 200,
  hockey: 160,
  mma: 300, // a full fight card runs ~5h prelims → main
  boxing: 240,
};

// Combat sports: one "event" is a whole card, not a home/away game.
const CARD_SPORTS = new Set(["mma", "boxing"]);

// yyyymmdd in UTC for ESPN's ?dates= param.
function yyyymmdd(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
}

// Pull fighter names out of a card title for the "rooting for?" suggestions,
// e.g. "UFC 329: McGregor vs. Holloway 2" → ["McGregor", "Holloway"].
function fightersFromName(name: string): string[] {
  const after = name.includes(":") ? name.slice(name.indexOf(":") + 1) : name;
  const parts = after.split(/\s+vs\.?\s+/i).map((s) => s.replace(/\s+\d+$/, "").trim());
  return parts.length === 2 && parts.every(Boolean) ? parts : [];
}

interface EspnCompetitor {
  homeAway?: string;
  team?: { displayName?: string; shortDisplayName?: string; abbreviation?: string };
}
interface EspnEvent {
  id?: string;
  date?: string;
  name?: string;
  shortName?: string;
  status?: { type?: { state?: string; completed?: boolean } };
  competitions?: { competitors?: EspnCompetitor[] }[];
}

async function fetchLeague({ sport, league, slug, rangeDays }: LeagueSpec): Promise<Fixture[]> {
  const base = `https://site.api.espn.com/apis/site/v2/sports/${sport}/${league}/scoreboard`;
  const url = rangeDays
    ? `${base}?dates=${yyyymmdd(Date.now())}-${yyyymmdd(Date.now() + rangeDays * 86_400_000)}`
    : base;
  const isCard = CARD_SPORTS.has(sport);
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 6000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, next: { revalidate: 60 } });
    if (!res.ok) return [];
    const data = (await res.json()) as { events?: EspnEvent[] };
    const lengthMin = LENGTH_MIN[sport] ?? 180;
    const out: Fixture[] = [];
    for (const ev of data.events ?? []) {
      const state = ev.status?.type?.state;
      // Drop finished games — a venue can't "go live" with a game that's over.
      if (state === "post" || ev.status?.type?.completed) continue;
      const startsAt = ev.date;
      if (!startsAt) continue;

      let matchup: string;
      let teams: string[];
      if (isCard) {
        // Combat card: the event name IS the headline; competitors[0] is only the
        // opening prelim, so never derive the matchup from it.
        matchup = ev.name || ev.shortName || "";
        teams = fightersFromName(matchup);
      } else {
        const comps = ev.competitions?.[0]?.competitors ?? [];
        const home = comps.find((c) => c.homeAway === "home") ?? comps[0];
        const away = comps.find((c) => c.homeAway === "away") ?? comps[1];
        const nameOf = (c?: EspnCompetitor) =>
          c?.team?.shortDisplayName || c?.team?.displayName || c?.team?.abbreviation || "";
        const awayName = nameOf(away);
        const homeName = nameOf(home);
        matchup = awayName && homeName ? `${awayName} vs ${homeName}` : ev.shortName || "";
        teams = [awayName, homeName].filter(Boolean);
      }
      if (!matchup) continue;

      const start = Date.parse(startsAt);
      const isLiveNow = state === "in";
      // For a live game, keep the window open (our length estimate can be short);
      // otherwise it's start + estimated length.
      const end = isLiveNow
        ? Math.max(start + lengthMin * 60_000, Date.now() + 90 * 60_000)
        : start + lengthMin * 60_000;
      out.push({
        id: `espn-${slug}-${ev.id ?? matchup}`,
        event_slug: slug,
        matchup,
        teams,
        starts_at: new Date(start).toISOString(),
        ends_at: new Date(end).toISOString(),
        live: isLiveNow,
      });
    }
    return out;
  } catch {
    return []; // timeout / network / parse — just contribute nothing
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET() {
  const results = await Promise.all(LEAGUES.map((l) => fetchLeague(l)));
  // Surface games within ~2.5 weeks so a full tournament run (World Cup
  // knockouts → final) and the next combat card show, not just today's slate.
  const horizon = Date.now() + 18 * 24 * 60 * 60 * 1000;
  // Dedupe by id — two source leagues can map to the same slug.
  const seen = new Set<string>();
  const fixtures = results
    .flat()
    .filter((f) => Date.parse(f.starts_at) <= horizon)
    .filter((f) => (seen.has(f.id) ? false : (seen.add(f.id), true)));

  // If every upstream came back empty (all leagues off-season / all failed),
  // fall back to the curated slate so the composer's picker is never blank.
  if (fixtures.length === 0) {
    return NextResponse.json({ fixtures: getFixtures(), source: "fallback" });
  }

  fixtures.sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
  return NextResponse.json({ fixtures, source: "espn" });
}
