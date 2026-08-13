"use client";

import { Navigation } from "lucide-react";
import {
  appleDirectionsUrl,
  googleDirectionsUrl,
  prefersAppleMaps,
  type Destination,
} from "@/lib/directions";

// A control that opens a destination in the phone's own maps app.
//
// The href is the GOOGLE url, always — it is correct on the server, correct on
// every platform including iOS, and correct with JavaScript off. iPhones get
// Apple Maps by intercepting the click instead. Deciding the href by sniffing
// the device during render would be a hydration mismatch; deciding it in an
// effect would mean the button briefly has no destination at all.
//
// ALWAYS opens in a new context. The iOS shell lists `*.apple.com` in its
// Capacitor allowNavigation (Sign in with Apple has to stay inside the
// webview), so a same-tab maps.apple.com link would render Apple's map WEB
// PAGE inside the app instead of handing off to Maps.
export function DirectionsButton({
  destination,
  label = "Directions",
  className,
  variant = "pill",
}: {
  destination: Destination;
  label?: string;
  className?: string;
  /** pill = the profile action row · link = quiet inline · chip = on a card */
  variant?: "pill" | "link" | "chip";
}) {
  const href = googleDirectionsUrl(destination);

  // Nothing to navigate to — no coordinates, no address. A Directions button
  // that opens an empty map is worse than no button.
  if (!href) return null;

  const styles =
    variant === "pill"
      ? "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-stone-900 px-3.5 py-2 text-[13px] font-medium text-white transition hover:bg-stone-800"
      : variant === "chip"
        // relative z-10: on a feed card the whole tile is a stretched link,
        // and without it this sits underneath and never receives the tap.
        ? "relative z-10 inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-stone-900/90 px-2 py-0.5 text-[11px] font-semibold text-white transition hover:bg-stone-900"
        : "inline-flex items-center gap-1.5 text-[13px] font-medium text-indigo-700 transition hover:text-indigo-900";

  const iconSize = variant === "chip" ? "h-3 w-3" : "h-4 w-4";

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => {
        // The card around this may expand on click, or be a stretched link.
        // Getting directions should do exactly one thing.
        e.stopPropagation();
        if (!prefersAppleMaps()) return;
        const apple = appleDirectionsUrl(destination);
        if (!apple) return;
        e.preventDefault();
        window.open(apple, "_blank", "noopener");
      }}
      className={className ?? styles}
    >
      <Navigation className={iconSize} />
      {label}
    </a>
  );
}
