"use client";

import { Apple, X } from "lucide-react";
import { useState } from "react";
import { usePathname } from "next/navigation";

// Replace with the real App Store listing once published.
const APP_STORE_URL = "https://apps.apple.com/app/whatslocal";

// Slim, dismissible site-wide banner promoting the iOS app. Sits under the SMS
// banner. Dismissal only hides it for the current page view — it shows again on
// every reload (no persistence).
export function AppBanner() {
  const [hidden, setHidden] = useState(false);
  const pathname = usePathname();

  // The Messages conversation view is full-screen (input pinned above the bottom
  // nav) — the promo banner would push the chat header down. Hide it there, same
  // as the footer.
  if (pathname?.startsWith("/messages")) return null;
  if (hidden) return null;

  return (
    <div className="relative z-40 border-b border-stone-200 bg-stone-900 text-white">
      <div className="mx-auto flex max-w-7xl items-center gap-2 px-3 py-3.5 text-sm sm:gap-3 sm:px-4 sm:py-4 md:px-8">
        <Apple className="h-4 w-4 shrink-0" />
        <p className="min-w-0 flex-1 truncate leading-snug sm:whitespace-normal">
          <span className="font-semibold">Get the WhatsLocal app</span>
          <span className="hidden text-white/70 sm:inline"> — live near you, in your pocket.</span>
        </p>
        <a
          href={APP_STORE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-semibold text-stone-900 transition hover:bg-white/90"
        >
          <span className="sm:hidden">Get app</span>
          <span className="hidden sm:inline">Download on the App Store</span>
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
