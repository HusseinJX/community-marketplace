// Bridge to the native @capacitor/geolocation plugin in the Capacitor iOS shell.
// iOS WKWebView doesn't implement the web `navigator.geolocation` API, so inside
// the native app we call the plugin through the Capacitor bridge injected on
// `window.Capacitor`. On the web (no native shell) this reports unavailable and
// the caller falls back to `navigator.geolocation`.

interface GeoPosition {
  coords: { latitude: number; longitude: number };
}
interface GeolocationPlugin {
  getCurrentPosition: (opts?: { enableHighAccuracy?: boolean; timeout?: number }) => Promise<GeoPosition>;
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

// Resolve the device's current position as [lat, lng]. Throws on denial/error so
// the caller can surface a message.
export async function getNativePosition(): Promise<[number, number]> {
  const plugin = cap()?.Plugins?.Geolocation;
  if (!plugin) throw new Error("Native geolocation unavailable");
  const pos = await plugin.getCurrentPosition({ enableHighAccuracy: true, timeout: 8000 });
  return [pos.coords.latitude, pos.coords.longitude];
}

// Unified position lookup: native plugin inside the iOS shell, browser
// geolocation on the web. Rejects on denial/unavailable so callers can fall
// back silently. `maximumAge` lets a recent fix return instantly.
export async function getUserPosition(): Promise<[number, number]> {
  if (nativeGeoAvailable()) return getNativePosition();
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Geolocation unavailable"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve([p.coords.latitude, p.coords.longitude]),
      (e) => reject(e),
      { timeout: 8000, maximumAge: 300_000 }
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
