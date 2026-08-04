// Bridge to the native @capacitor/geolocation plugin in the Capacitor iOS shell.
// iOS WKWebView doesn't implement the web `navigator.geolocation` API, so inside
// the native app we call the plugin through the Capacitor bridge injected on
// `window.Capacitor`. On the web (no native shell) this reports unavailable and
// the caller falls back to `navigator.geolocation`.

interface GeoPosition {
  coords: { latitude: number; longitude: number };
}
interface GeoOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
}
interface GeolocationPlugin {
  getCurrentPosition: (opts?: GeoOptions) => Promise<GeoPosition>;
}
interface CapacitorGlobal {
  isNativePlatform?: () => boolean;
  Plugins?: { Geolocation?: GeolocationPlugin };
}

function cap(): CapacitorGlobal | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
}

// True only inside the native iOS shell with the Geolocation plugin registered.
export function nativeGeoAvailable(): boolean {
  const c = cap();
  return !!c?.isNativePlatform?.() && !!c?.Plugins?.Geolocation;
}

// ── Why coarse + cached is the DEFAULT ───────────────────────────────────────
// Every caller here wants a *neighborhood*, not a doorstep: a "Mission District,
// SF" post label, distance-in-km sorting, a you-are-here pin on a city map. None
// of them can tell 10m from 500m.
//
// `enableHighAccuracy: true` makes iOS spin up the GPS radio and wait for it to
// converge — commonly several seconds cold, much worse indoors — to buy
// precision nothing downstream reads. Coarse location answers from the wifi/cell
// fix that iOS already has, typically in well under a second, and `maximumAge`
// lets a fix taken minutes ago return with no wait at all.
//
// So: ask for precision only when something actually depends on it, via
// `{ highAccuracy: true }`. Don't flip the default back.
const COARSE: GeoOptions = { enableHighAccuracy: false, timeout: 8000, maximumAge: 300_000 };
const PRECISE: GeoOptions = { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 };

export interface PositionOptions {
  /** Wait for a real GPS fix. Slow (seconds). Only for true precision needs. */
  highAccuracy?: boolean;
}

// Resolve the device's current position as [lat, lng]. Throws on denial/error so
// the caller can surface a message.
export async function getNativePosition(opts: PositionOptions = {}): Promise<[number, number]> {
  const plugin = cap()?.Plugins?.Geolocation;
  if (!plugin) throw new Error("Native geolocation unavailable");
  const pos = await plugin.getCurrentPosition(opts.highAccuracy ? PRECISE : COARSE);
  return [pos.coords.latitude, pos.coords.longitude];
}

// Unified position lookup: native plugin inside the iOS shell, browser
// geolocation on the web. Rejects on denial/unavailable so callers can fall
// back silently. Coarse + cached by default — see the note above.
export async function getUserPosition(opts: PositionOptions = {}): Promise<[number, number]> {
  if (nativeGeoAvailable()) return getNativePosition(opts);
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Geolocation unavailable"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve([p.coords.latitude, p.coords.longitude]),
      (e) => reject(e),
      opts.highAccuracy ? PRECISE : COARSE
    );
  });
}

// Great-circle distance in km between two [lat, lng] points (haversine).
export function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
