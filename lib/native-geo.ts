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
