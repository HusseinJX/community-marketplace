"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getConsent, setConsent } from "@/lib/consent";
import { useIsNativeApp } from "@/lib/native";

// Lightweight cookie-consent banner for the ad pixels. Shows only until the user
// decides; the choice persists. Accept → Meta + Google tags flip on (Consent
// Mode). Reject → ad pixels stay off / cookieless. PostHog (first-party) runs
// either way. Sits above the bottom nav.
export function ConsentBanner() {
  const [show, setShow] = useState(false);
  // Never show the cookie/ad-tracking prompt inside the native iOS app. The ad
  // pixels don't run there (see AdPixels), so there's nothing to consent to —
  // and a prompt that mentions ad tracking without an App Tracking Transparency
  // request is an App Store rejection (Guideline 5.1.2(i)). If ads are ever
  // enabled on iOS, wire ATT + the App Privacy declaration FIRST, then re-show.
  const native = useIsNativeApp();

  useEffect(() => {
    if (getConsent() === null) setShow(true);
  }, []);

  if (native || !show) return null;

  function decide(state: "granted" | "denied") {
    setConsent(state);
    setShow(false);
  }

  return (
    <div
      className="fixed inset-x-0 z-40 px-3"
      style={{ bottom: "calc(3.5rem + env(safe-area-inset-bottom))" }}
      role="dialog"
      aria-label="Cookie consent"
    >
      <div className="mx-auto flex max-w-2xl flex-col gap-3 rounded-2xl border border-stone-200 bg-white/95 p-4 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[13px] leading-snug text-stone-600">
          We use cookies to understand traffic and to show you relevant ads on Google,
          YouTube, Facebook &amp; Instagram. See our{" "}
          <Link href="/privacy" className="underline hover:text-stone-900">
            privacy policy
          </Link>
          .
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => decide("denied")}
            className="rounded-full border border-stone-300 px-4 py-2 text-[13px] font-medium text-stone-700 transition hover:border-stone-400 hover:text-stone-900"
          >
            Reject
          </button>
          <button
            type="button"
            onClick={() => decide("granted")}
            className="rounded-full bg-stone-900 px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-stone-800"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
