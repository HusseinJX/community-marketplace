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
    // OFF — Sentry owns errors now (instrumentation-client.ts). Leaving this on
    // meant the same crash landed in two dashboards as two unrelated issues with
    // two IDs, and PostHog only ever saw the browser half anyway. The link runs
    // the other way instead: every Sentry event carries this session's replay
    // URL, so an issue opens the recording of the person who hit it.
    capture_exceptions: false,
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
  applyInternalFlag();
  return true;
}

/** Devices marked as ours, so our own traffic can be filtered out of everything. */
const INTERNAL_KEY = "wl_internal";

/**
 * Marks this DEVICE as internal — visit `/?internal=1` once per browser
 * (`?internal=0` to undo).
 *
 * Filtering our own sessions out by email only works once we're signed in, and
 * most dogfooding is signed out. Worse, one person is several "new people" to
 * PostHog: Safari, Chrome, an incognito window and the iOS app's WKWebView each
 * have their own cookie jar and so their own distinct_id. At current volume that
 * is most of the data, and it makes every replay list and funnel read as
 * strangers arriving.
 *
 * So the flag lives in localStorage, not on the identity: it survives sign-out,
 * applies to anonymous sessions, and is set per browser — which is exactly the
 * granularity of the problem. `$set` puts it on the PERSON (so one "Internal"
 * cohort filters replays and insights), `register` puts it on every event (so
 * event-level filters work too).
 */
let internalApplied = false;

function applyInternalFlag() {
  try {
    const q = new URLSearchParams(window.location.search).get("internal");
    if (q === "1") window.localStorage.setItem(INTERNAL_KEY, "1");
    else if (q === "0") {
      window.localStorage.removeItem(INTERNAL_KEY);
      internalApplied = false;
    }

    // Applied once per page load. Re-registering on every pageview would emit a
    // $set with each navigation to say a thing that has not changed.
    if (internalApplied) return;
    if (window.localStorage.getItem(INTERNAL_KEY) !== "1") return;
    internalApplied = true;
    posthog.setPersonProperties({ is_internal: true });
    posthog.register({ is_internal: true });
  } catch {
    // private mode / storage blocked — the flag just doesn't stick, which is
    // the same as not being marked. Never let this break analytics init.
  }
}

function PageviewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!ensureInit() || !pathname) return;
    // Also here, so arriving at ?internal=1 by client-side navigation marks the
    // device rather than silently doing nothing until the next full load.
    applyInternalFlag();
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
