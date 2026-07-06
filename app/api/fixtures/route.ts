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
const LEAGUES: { sport: string; league: string; slug: string }[] = [
  { sport: "soccer", league: "fifa.world", slug: "world-cup" },
  { sport: "soccer", league: "fifa.friendly", slug: "soccer" },
  { sport: "soccer", league: "uefa.champions", slug: "champions-league" },
  { sport: "soccer", league: "eng.1", slug: "premier-league" },
  { sport: "soccer", league: "esp.1", slug: "la-liga" },
  { sport: "soccer", league: "mex.1", slug: "liga-mx" },
  { sport: "soccer", league: "usa.1", slug: "soccer" },
  { sport: "basketball", league: "nba", slug: "nba" },
  { sport: "football", league: "nfl", slug: "nfl" },
  { sport: "football", league: "college-football", slug: "college-football" },
  { sport: "baseball", league: "mlb", slug: "mlb" },
  { sport: "hockey", league: "nhl", slug: "nhl" },
];

// Rough broadcast length per sport (minutes) so we can synthesize an end time —
// ESPN's scoreboard doesn't give one. Used only to decide "still live-ish".
const LENGTH_MIN: Record<string, number> = {
  soccer: 130,
  basketball: 160,
  football: 210,
  baseball: 200,
  hockey: 160,
};

interface EspnCompetitor {
  homeAway?: string;
  team?: { displayName?: string; shortDisplayName?: string; abbreviation?: string };
}
interface EspnEvent {
  id?: string;
  date?: string;
  shortName?: string;
  status?: { type?: { state?: string; completed?: boolean } };
  competitions?: { competitors?: EspnCompetitor[] }[];
}

async function fetchLeague(
  sport: string,
  league: string,
  slug: string
): Promise<Fixture[]> {
  const url = `https://site.api.espn.com/apis/site/v2/sports/${sport}/${league}/scoreboard`;
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

      const comps = ev.competitions?.[0]?.competitors ?? [];
      const home = comps.find((c) => c.homeAway === "home") ?? comps[0];
      const away = comps.find((c) => c.homeAway === "away") ?? comps[1];
      const nameOf = (c?: EspnCompetitor) =>
        c?.team?.shortDisplayName || c?.team?.displayName || c?.team?.abbreviation || "";
      const awayName = nameOf(away);
      const homeName = nameOf(home);
      const matchup =
        awayName && homeName ? `${awayName} vs ${homeName}` : ev.shortName || "";
      if (!matchup) continue;

      const start = Date.parse(startsAt);
      const isLiveNow = state === 'in';
      // For a live game, keep the window open (our length estimate can be short);
      // otherwise it's start + estimated length.
      const end = isLiveNow
        ? Math.max(start + lengthMin * 60_000, Date.now() + 90 * 60_000)
        : start + lengthMin * 60_000;
      out.push({
        id: `espn-${slug}-${ev.id ?? matchup}`,
        event_slug: slug,
        matchup,
        teams: [awayName, homeName].filter(Boolean),
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
  const results = await Promise.all(
    LEAGUES.map((l) => fetchLeague(l.sport, l.league, l.slug))
  );
  // Only surface games kicking off within the next week — a venue goes live for
  // what's on now/soon, not fixtures weeks out.
  const horizon = Date.now() + 7 * 24 * 60 * 60 * 1000;
  const fixtures = results.flat().filter((f) => Date.parse(f.starts_at) <= horizon);

  // If every upstream came back empty (all leagues off-season / all failed),
  // fall back to the curated slate so the composer's picker is never blank.
  if (fixtures.length === 0) {
    return NextResponse.json({ fixtures: getFixtures(), source: "fallback" });
  }

  fixtures.sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
  return NextResponse.json({ fixtures, source: "espn" });
}
