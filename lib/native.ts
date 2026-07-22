import { useEffect, useState } from "react";

// Is the app running inside the native (Capacitor iOS) shell, as opposed to a
// normal web browser? The native runtime injects `window.Capacitor` and
// `isNativePlatform()` returns true there. SSR-safe (returns false on the server).
type Cap = { isNativePlatform?: () => boolean };
export function isNativeApp(): boolean {
  if (typeof window === "undefined") return false;
  const c = (window as unknown as { Capacitor?: Cap }).Capacitor;
  return !!c?.isNativePlatform?.();
}

// Hook form for client components. Starts false (so server render and the first
// client render agree — no hydration mismatch), then flips true after mount when
// running natively.
//
// ⚠️ Used to hide every in-app subscription paywall on iOS. Apple Guideline
// 3.1.1 requires digital/subscription unlocks to go through In-App Purchase, so
// the native build must NOT show Stripe prices, "Upgrade" buttons, or links to
// web checkout. Features already unlocked (e.g. a reviewer's Pro demo account)
// are fine to show — only the *purchase* path is hidden. Remove these gates only
// once real StoreKit IAP exists.
export function useIsNativeApp(): boolean {
  const [native, setNative] = useState(false);
  useEffect(() => setNative(isNativeApp()), []);
  return native;
}
