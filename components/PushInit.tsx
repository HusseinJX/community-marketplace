"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@clerk/nextjs";
import { nativePushAvailable, initNativePush } from "@/lib/native-push";
import { initNativeLinks } from "@/lib/native-links";

// Mounted app-wide. Inside the native iOS app it registers the device with APNs
// and posts the token to /api/push/register (linked to the Clerk user). No-ops on
// the plain website. Re-runs when the user signs in/out so the token re-associates.
export function PushInit() {
  const { isLoaded, userId } = useAuth();
  const lastKey = useRef<string | null>(null);

  // Register the Universal-Link handler once so OAuth callbacks return in-app.
  useEffect(() => { initNativeLinks(); }, []);

  useEffect(() => {
    if (!isLoaded || !nativePushAvailable()) return;
    // Re-register when the signed-in user changes so the token links to them.
    const key = userId ?? "anon";
    if (lastKey.current === key) return;
    lastKey.current = key;

    initNativePush((token) => {
      fetch("/api/push/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, platform: "ios" }),
      }).catch(() => {});
    }).catch(() => {});
  }, [isLoaded, userId]);

  return null;
}
