"use client";

import { Apple, X } from "lucide-react";
import { useState } from "react";
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
// Dismissal only lasts for the current page view — it returns on reload.
export function AppBanner() {
  const [hidden, setHidden] = useState(false);
  const isNative = useIsNativeApp();

  if (hidden || isNative) return null;

  return (
    <div className="relative z-40 hidden border-b border-stone-200 bg-stone-900 text-white md:block">
      <div className="mx-auto flex max-w-7xl items-center gap-2 px-3 py-3.5 text-sm sm:gap-3 sm:px-4 sm:py-4 md:px-8">
        <Apple className="h-4 w-4 shrink-0" />
        <p className="min-w-0 flex-1 leading-snug">
          <span className="font-semibold">Get the WhatsLocal app</span>
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
          onClick={() => setHidden(true)}
          aria-label="Dismiss"
          className="shrink-0 rounded-full p-1 text-white/80 transition hover:bg-white/15 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
