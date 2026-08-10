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
    // Route ingestion through our own /ingest proxy (next.config rewrites) so ad
    // blockers don't drop it; ui_host keeps "open in PostHog" links pointing at
    // the real app.
    api_host: "/ingest",
    ui_host: "https://us.posthog.com",
    capture_pageview: false,
    capture_pageleave: true,
    person_profiles: "always",
    // Error tracking — autocapture uncaught exceptions + unhandled promise
    // rejections (wires window.onerror/onunhandledrejection). Crashes land in
    // PostHog's Error Tracking, tied to the same person/session — so no separate
    // tool (Sentry) is needed yet.
    capture_exceptions: true,
    // Session replay is ON at the project level (PostHog remote config returns a
    // sessionRecording object, not `false`) — so these masking rules are live,
    // not preparation for a switch someone still has to flip.
    //
    // `maskAllInputs` only covers the box someone is TYPING into. Text already
    // rendered on screen is captured unless it matches `maskTextSelector`, so
    // **every surface that renders what a person said carries `data-private`**
    // on the container: the vendor customer inbox (incl. the list previews), the
    // assistant chats, community rooms, collab/event threads, and the onboarding
    // and join interviews. rrweb masks the matched element and its descendants,
    // so one attribute on the list wrapper covers every bubble inside it.
    //
    // Adding a new conversation surface? Mark it here or it gets recorded.
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
