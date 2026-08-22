"use client";

import { useIsNativeApp } from "@/lib/native";

/**
 * Renders its children ONLY on the web.
 *
 * ⚠️ App Store 3.1.1: any price shown inside the app must come from StoreKit.
 * A "$30/mo" typed into a page is the rejection, so every block that names a
 * subscription price outside /vendor/billing (which reads StoreKit natively)
 * goes behind this.
 *
 * It exists because the server pages that need this can't call the hook: a
 * server component has no idea what shell it is being rendered into.
 */
export function NativeGate({ children }: { children: React.ReactNode }) {
  const native = useIsNativeApp();
  if (native) return null;
  return <>{children}</>;
}
