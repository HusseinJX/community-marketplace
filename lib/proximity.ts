// Distance between the reader and a member, in miles.
//
// The events feed has ranked by distance for a while; nothing else did, even
// though 93% of members already carry latitude/longitude (the map draws pins
// from them). This is the shared piece so business surfaces rank the same way
// the feed does, and — more importantly — fail the same way:
//
//   A record we could not place NEVER shows a distance and NEVER ranks as if
//   it were nearby. It sorts last, and its chip says so.
//
// That is not fussiness: a distance filter that silently passes through
// unplaced records is not a filter, which is how events 180 miles away once
// topped a "no car" feed.

import { distanceKm } from "@/lib/native-geo";
import type { Position } from "@/lib/home-position";

const KM_TO_MI = 0.621371;

/** A record's own coordinates, or null when it has none. Never guessed. */
export interface Placeable {
  latitude?: number | null;
  longitude?: number | null;
}

export function coordsOf(p: Placeable | null | undefined): Position | null {
  if (!p) return null;
  const { latitude: lat, longitude: lng } = p;
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  // 0,0 is the Atlantic. It is what an empty numeric column looks like, and it
  // would place every unfilled record ~5000 miles away rather than nowhere.
  if (lat === 0 && lng === 0) return null;
  return { lat, lng };
}

/** Miles from `from` to the record, or null if either end is unknown. */
export function milesTo(from: Position | null, p: Placeable | null | undefined): number | null {
  if (!from) return null;
  const c = coordsOf(p);
  if (!c) return null;
  const mi = distanceKm(from.lat, from.lng, c.lat, c.lng) * KM_TO_MI;
  // One decimal is all a neighbourhood-accurate fix can honestly support.
  return Math.round(mi * 10) / 10;
}

/** Nearest first; anything unplaced sorts to the end rather than to zero. */
export function byDistance(a: number | null, b: number | null): number {
  return (a ?? Infinity) - (b ?? Infinity);
}

/** Radius choices shared with the events feed, so "2 mi" means one thing. */
export const RADIUS_STEPS = [0.5, 1, 2, 5, 10];

/** Short label for a distance chip. Under ~0.2mi, "here" beats "0.1 mi". */
export function milesLabel(mi: number): string {
  return mi < 0.2 ? "here" : `${mi} mi`;
}
