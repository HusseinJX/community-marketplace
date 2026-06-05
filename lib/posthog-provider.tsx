"use client";

import { Suspense, useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import posthog from "posthog-js";

function ensureInit() {
  if (typeof window === "undefined") return false;
  if ((posthog as any).__loaded) return true;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) {
    if (!(window as any).__phWarned) {
      console.warn("[posthog] NEXT_PUBLIC_POSTHOG_KEY missing — analytics disabled");
      (window as any).__phWarned = true;
    }
    return false;
  }
  posthog.init(key, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
    capture_pageview: false,
    capture_pageleave: true,
    person_profiles: "always",
    session_recording: {
      maskAllInputs: true,
      maskTextSelector: "[data-private]",
    },
    loaded: (ph) => {
      console.log("[posthog] loaded, distinctId=", ph.get_distinct_id());
    },
  });
  return true;
}

function PageviewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!ensureInit() || !pathname) return;
    const url = searchParams?.toString()
      ? `${pathname}?${searchParams.toString()}`
      : pathname;
    posthog.capture("$pageview", { $current_url: window.location.origin + url });
  }, [pathname, searchParams]);

  return null;
}

function IdentityBridge() {
  const { user, isLoaded } = useUser();
  const lastUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!ensureInit() || !isLoaded) return;
    const currentId = user?.id ?? null;
    const lastId = lastUserIdRef.current;

    if (currentId && currentId !== lastId) {
      posthog.identify(currentId, {
        email: user?.primaryEmailAddress?.emailAddress,
        name: user?.fullName ?? undefined,
      });
    } else if (!currentId && lastId) {
      // genuine logout transition — clear identity so future events are anon again
      posthog.reset();
    }
    // else: anonymous→anonymous, or same identified user → do nothing
    // (preserves the anon distinct_id cookie across page loads)

    lastUserIdRef.current = currentId;
  }, [user, isLoaded]);

  return null;
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    ensureInit();
  }, []);

  return (
    <>
      <Suspense fallback={null}>
        <PageviewTracker />
      </Suspense>
      <IdentityBridge />
      {children}
    </>
  );
}
