import type { LiveBroadcast } from "@/components/live/types";
import { isFixtureLive, type Fixture } from "@/lib/live-fixtures";

// Demo "Live Now" content built from the REAL games slate (/api/fixtures, ESPN):
// the matches are real live games, the PLACES showing them are demo venues. This
// makes the home live section reflect what's actually on while we don't yet have
// real venue broadcasts.
//
// Deterministic ids (demo-bc-<venue>-<fixtureId>) so the feed and the /live/[id]
// detail page resolve the same broadcast — build once here, use everywhere.

interface DemoVenue {
  member_id: string;
  member_name: string;
  neighborhood: string;
  city: string;
  latitude: number;
  longitude: number;
  save_count: number;
  image_urls: string[];
}

// All map to real sports-bar profiles in demo-members, so the "view venue" link
// resolves. Used to populate the "places showing it" list for each live match.
const VENUE_POOL: DemoVenue[] = [
  { member_id: "demo-el-tri-cantina", member_name: "El Tri Cantina", neighborhood: "Boyle Heights", city: "Los Angeles", latitude: 34.0444, longitude: -118.2007, save_count: 67, image_urls: ["https://images.unsplash.com/photo-1543007630-9710e4a00a20?w=900&q=80", "https://images.unsplash.com/photo-1551038247-3d9af20df552?w=900&q=80"] },
  { member_id: "demo-courtside-sports-bar", member_name: "Courtside Sports Bar", neighborhood: "Downtown LA", city: "Los Angeles", latitude: 34.0481, longitude: -118.2575, save_count: 12, image_urls: ["https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=900&q=80"] },
  { member_id: "demo-the-corner-tap", member_name: "The Corner Tap", neighborhood: "Echo Park", city: "Los Angeles", latitude: 34.0782, longitude: -118.2606, save_count: 44, image_urls: ["https://images.unsplash.com/photo-1538488881038-e252a119ace7?w=900&q=80"] },
  { member_id: "demo-azteca-grill", member_name: "Azteca Grill & Bar", neighborhood: "East LA", city: "Los Angeles", latitude: 34.0224, longitude: -118.1745, save_count: 31, image_urls: [] },
  { member_id: "demo-highland-pub", member_name: "Highland Pub", neighborhood: "Highland Park", city: "Los Angeles", latitude: 34.1156, longitude: -118.1926, save_count: 28, image_urls: [] },
];

function makeBroadcast(v: DemoVenue, fx: Fixture, team: string | null): LiveBroadcast {
  return {
    id: `demo-bc-${v.member_id}-${fx.id}`,
    member_id: v.member_id,
    member_name: v.member_name,
    event_slug: fx.event_slug,
    event_label: null,
    whats_on: fx.matchup,
    note: null,
    supports_team: team,
    image_urls: v.image_urls,
    livestream_url: null,
    starts_at: fx.starts_at,
    ends_at: fx.ends_at, // ends when the match ends
    latitude: v.latitude,
    longitude: v.longitude,
    neighborhood: v.neighborhood,
    city: v.city,
    active: true,
    save_count: v.save_count,
    saved: false,
  };
}

/**
 * Map demo venues onto the live games in `fixtures`. Each shown match gets ≥2
 * venues (venues don't repeat across matches). Pure + deterministic.
 */
export function buildDemoBroadcastsFromFixtures(
  fixtures: Fixture[],
  now: number = Date.now()
): LiveBroadcast[] {
  const live = fixtures.filter((f) => isFixtureLive(f, now));
  if (live.length === 0) return [];

  // Cap matches so each can get at least ~2 venues from the pool.
  const maxMatches = Math.max(1, Math.floor(VENUE_POOL.length / 2));
  const shown = live.slice(0, maxMatches);

  const perMatch: LiveBroadcast[][] = shown.map(() => []);
  VENUE_POOL.forEach((v, i) => {
    const fi = i % shown.length;
    const fx = shown[fi];
    const team = fx.teams?.[perMatch[fi].length % (fx.teams.length || 1)] ?? null;
    perMatch[fi].push(makeBroadcast(v, fx, team));
  });
  return perMatch.flat();
}

// ── Client fetch helpers (used by the feed + the /live/[id] detail page) ────────

async function fetchFixtures(): Promise<Fixture[]> {
  try {
    const res = await fetch("/api/fixtures");
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.fixtures) ? (data.fixtures as Fixture[]) : [];
  } catch {
    return [];
  }
}

/** Demo broadcasts for whatever games are live right now (real slate). */
export async function fetchDemoLiveBroadcasts(): Promise<LiveBroadcast[]> {
  return buildDemoBroadcastsFromFixtures(await fetchFixtures());
}

/** Resolve one demo broadcast by id (for /live/[id]). */
export async function findDemoLiveBroadcast(id: string): Promise<LiveBroadcast | null> {
  return (await fetchDemoLiveBroadcasts()).find((b) => b.id === id) ?? null;
}
