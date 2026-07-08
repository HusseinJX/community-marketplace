// Bridge to the native @capacitor/push-notifications plugin in the Capacitor iOS
// shell. The hosted web app doesn't import the plugin's JS package — we call it
// through the Capacitor bridge injected on `window.Capacitor`. On the web (no
// native shell) this reports unavailable and push registration is skipped.

interface PermStatus { receive: "prompt" | "denied" | "granted" | "prompt-with-rationale" }
interface PushPlugin {
  checkPermissions: () => Promise<PermStatus>;
  requestPermissions: () => Promise<PermStatus>;
  register: () => Promise<void>;
  addListener: (event: string, cb: (data: unknown) => void) => Promise<unknown> | unknown;
}
interface CapacitorGlobal {
  isNativePlatform?: () => boolean;
  Plugins?: { PushNotifications?: PushPlugin };
}

function cap(): CapacitorGlobal | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
}

export function nativePushAvailable(): boolean {
  const c = cap();
  return !!c?.isNativePlatform?.() && !!c?.Plugins?.PushNotifications;
}

// Ask permission, register with APNs, and invoke `onToken` with the device token
// once Apple returns it. Safe to call when unavailable (does nothing).
export async function initNativePush(onToken: (token: string) => void): Promise<void> {
  const plugin = cap()?.Plugins?.PushNotifications;
  if (!plugin) return;

  let perm = await plugin.checkPermissions();
  if (perm.receive === "prompt" || perm.receive === "prompt-with-rationale") {
    perm = await plugin.requestPermissions();
  }
  if (perm.receive !== "granted") return;

  // 'registration' fires with { value: "<apns-token>" } after register().
  await plugin.addListener("registration", (data) => {
    const token = (data as { value?: string })?.value;
    if (token) onToken(token);
  });
  await plugin.register();
}

// Route the app when the user taps a notification. The payload's `url` (set by
// sendPushToUser) rides in the APS `data`. Safe to call when unavailable.
export async function onPushTap(onUrl: (url: string) => void): Promise<void> {
  const plugin = cap()?.Plugins?.PushNotifications;
  if (!plugin) return;
  await plugin.addListener("pushNotificationActionPerformed", (data) => {
    // Shape: { notification: { data: { url } } } — `url` is a top-level custom key.
    const d = data as { notification?: { data?: Record<string, unknown> } };
    const url = d?.notification?.data?.url;
    if (typeof url === "string" && url) onUrl(url);
  });
}
