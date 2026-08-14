"use client";

import { Apple, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useIsNativeApp } from "@/lib/native";

// Live App Store listing.
const APP_STORE_URL = "https://apps.apple.com/app/whatslocal-ai/id6793615366";

// Slim, dismissible banner promoting the iOS app.
//
// DESKTOP ONLY (`hidden md:block`). On a phone the visitor is one tap from the
// App Store anyway and the bar eats scarce vertical space above the fold; on a
// desktop it's the only way to tell someone the app exists. Also hidden inside
// the native app itself, which matters for iPad — that's wide enough to clear
// the md breakpoint, and "download our app" inside the app is nonsense.
//
// Dismissal STICKS. It used to be plain useState, so the X hid the bar until
// the next reload and then it came straight back — which reads as a broken
// close button, and is worse than having no close button at all: the visitor
// has told us no and we ask again on every page.
//
// Stored rather than remembered in memory, and with no expiry. "I don't want
// the app" is not a fact that goes stale, and re-asking someone who already
// said no is the cheapest possible way to be annoying. If we ever want to
// re-prompt, that should be a deliberate campaign with a new key, not a
// side effect of them refreshing the page.
const DISMISS_KEY = "wl_app_banner_dismissed";

export function AppBanner() {
  const [hidden, setHidden] = useState(false);
  // Not rendered until we've read storage. Starting visible and hiding in an
  // effect would flash the bar on every load for someone who dismissed it
  // months ago — and it would push the whole page down and back up while it
  // did, which is worse than the flash.
  const [ready, setReady] = useState(false);
  const isNative = useIsNativeApp();

  useEffect(() => {
    try {
      if (window.localStorage.getItem(DISMISS_KEY) === "1") setHidden(true);
    } catch {
      /* private mode — the banner just isn't dismissible across reloads */
    }
    setReady(true);
  }, []);

  const dismiss = () => {
    setHidden(true);
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* see above */
    }
  };

  if (!ready || hidden || isNative) return null;

  // z-20, BELOW the sticky header's z-30. At z-40 this scrolled OVER the nav
  // instead of under it — the banner only needs to sit above ordinary page
  // content, and a sticky nav must always win.
  return (
    <div className="relative z-20 hidden border-b border-stone-200 bg-stone-900 text-white md:block">
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-3.5 text-sm sm:gap-3 sm:py-4 md:px-8">
        <Apple className="h-4 w-4 shrink-0" />
        <p className="min-w-0 flex-1 leading-snug">
          <span className="font-semibold">Get the WhatsLocal AI app</span>
          <span className="text-white/70"> — live near you, in your pocket.</span>
        </p>
        <a
          href={APP_STORE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-semibold text-stone-900 transition hover:bg-white/90"
        >
          Download on the App Store
        </a>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="shrink-0 rounded-full p-1 text-white/80 transition hover:bg-white/15 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
