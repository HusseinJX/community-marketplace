// Bridge to the native Core NFC plugin in the Capacitor iOS shell (whatslocal-ios).
// The hosted web app doesn't import the plugin's JS package, so we call it through
// the Capacitor bridge that the native runtime injects on `window.Capacitor`.
// On the web (no native shell) these report unavailable and the caller falls back
// to Web NFC (Android Chrome).

interface NfcPlugin {
  scan: () => Promise<{ value?: string }>;
}
interface CapacitorGlobal {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
  Plugins?: { Nfc?: NfcPlugin };
}

function cap(): CapacitorGlobal | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
}

// True only inside the native iOS shell with the Nfc plugin registered.
export function nativeNfcAvailable(): boolean {
  const c = cap();
  return !!c?.isNativePlatform?.() && !!c?.Plugins?.Nfc;
}

// Present the system NFC sheet and resolve the tag's URL/text. Throws on
// cancel/error so the caller can surface a message.
export async function scanNativeNfc(): Promise<string> {
  const plugin = cap()?.Plugins?.Nfc;
  if (!plugin) throw new Error("Native NFC unavailable");
  const res = await plugin.scan();
  const value = (res?.value ?? "").toString();
  if (!value) throw new Error("Empty tag");
  return value;
}
