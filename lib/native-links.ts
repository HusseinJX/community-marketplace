// Universal-link handling for the Capacitor iOS shell. When Clerk's OAuth
// callback (an https://whatslocal.ai/... URL) is opened via a Universal Link,
// iOS launches THIS app instead of Safari. We then navigate the in-app webview
// to that URL's path so clerk-js processes the callback (the __clerk_handshake
// token) and establishes the session inside the webview. No-ops on the web.

interface AppPlugin {
  addListener: (event: "appUrlOpen", cb: (data: { url: string }) => void) => Promise<unknown> | unknown;
}
interface CapacitorGlobal {
  isNativePlatform?: () => boolean;
  Plugins?: { App?: AppPlugin };
}

function cap(): CapacitorGlobal | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
}

export function nativeLinksAvailable(): boolean {
  const c = cap();
  return !!c?.isNativePlatform?.() && !!c?.Plugins?.App;
}

// Register the deep-link handler. Returns without doing anything on the web.
export function initNativeLinks(): void {
  const plugin = cap()?.Plugins?.App;
  if (!plugin) return;
  plugin.addListener("appUrlOpen", ({ url }) => {
    try {
      const u = new URL(url);
      // Same-origin callback → navigate the webview so Clerk finalizes the
      // session here (cookies land in the webview, not Safari).
      if (u.origin === window.location.origin) {
        window.location.href = u.pathname + u.search + u.hash;
      }
    } catch {
      /* ignore malformed urls */
    }
  });
}
