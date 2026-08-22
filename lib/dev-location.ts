"use client";

/**
 * ── Pretend to be somewhere else (DEV ONLY) ────────────────────────────────
 *
 * Everything on this site sorts, ranks and labels by how far you are from it,
 * and the person building it is always in San Francisco. So the one view that
 * can never be checked is the one most first-time visitors will get: someone
 * in Chicago, or London, or forty miles from the nearest listing.
 *
 * This overrides the DEVICE FIX rather than the city header, and that is the
 * whole point of it. A city override (`wl_home_city`) says "show me Oakland"
 * while the device still knows you are in SF — which is a real feature, but it
 * simulates a San Franciscan browsing Oakland, not an Oaklander. Replacing
 * what `getUserPosition` returns puts every consumer downstream — the
 * directory's distance sort, the events feed's proximity ranking, the map's
 * you-are-here pin, the share composer's location tag — behind the same lie at
 * once, with nothing to remember to update.
 *
 * DEV ONLY, and gated on NODE_ENV rather than on demo mode or a flag: a
 * production build strips the branch, so this cannot reach an App Store user
 * even by accident. That matters more here than usual — a control that fakes
 * the location tag on a post is not something to leave reachable in the wild.
 */

export interface DevLocation {
  lat: number;
  lng: number;
  label: string;
}

/** Where the pretending is allowed to happen. */
export const DEV_LOCATION_ENABLED = process.env.NODE_ENV !== "production";

const KEY = "wl_dev_location";

// Read once per page load. The value only changes through setDevLocation,
// which reloads, so a module-scope cache can never go stale.
let cached: DevLocation | null | undefined;

export function devLocation(): DevLocation | null {
  if (!DEV_LOCATION_ENABLED) return null;
  if (cached !== undefined) return cached;
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    const d = raw ? (JSON.parse(raw) as DevLocation) : null;
    cached =
      d && typeof d.lat === "number" && typeof d.lng === "number" ? d : null;
  } catch {
    cached = null;
  }
  return cached;
}

/** Null = stop pretending. Caller reloads; see the toggle. */
export function writeDevLocation(loc: DevLocation | null): void {
  if (!DEV_LOCATION_ENABLED || typeof window === "undefined") return;
  try {
    if (loc) window.localStorage.setItem(KEY, JSON.stringify(loc));
    else window.localStorage.removeItem(KEY);
  } catch {
    /* private mode — the toggle is a dev convenience, not worth throwing for */
  }
  cached = undefined;
}

/**
 * Somewhere to be. Two of these are not cities on purpose:
 *
 *  - "Rural Kansas" is the empty state. It is the only way to see what the app
 *    says to someone with nothing within 500 miles, which is most of the
 *    country and every visitor who arrives before we have their city.
 *  - "Just outside SF" is the near-miss — close enough that some things are in
 *    range and others are not, which is where distance bugs actually live.
 */
export const DEV_PLACES: DevLocation[] = [
  { label: "San Francisco", lat: 37.7749, lng: -122.4194 },
  { label: "Oakland", lat: 37.8044, lng: -122.2712 },
  { label: "Just outside SF (San Jose)", lat: 37.3382, lng: -121.8863 },
  { label: "Los Angeles", lat: 34.0522, lng: -118.2437 },
  { label: "New York", lat: 40.7128, lng: -74.006 },
  { label: "Chicago", lat: 41.8781, lng: -87.6298 },
  { label: "Miami", lat: 25.7617, lng: -80.1918 },
  { label: "Rural Kansas (nothing nearby)", lat: 38.5, lng: -98.5 },
  { label: "London", lat: 51.5074, lng: -0.1278 },
  { label: "Tokyo", lat: 35.6762, lng: 139.6503 },
  { label: "Sydney", lat: -33.8688, lng: 151.2093 },
  { label: "Arusha, Tanzania", lat: -3.3869, lng: 36.683 },
];
