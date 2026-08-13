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
  asButton = false,
}: {
  destination: Destination;
  label?: string;
  className?: string;
  /** pill = the profile action row · link = quiet inline · chip = on a card */
  variant?: "pill" | "link" | "chip";
  /**
   * Render a <button> instead of an <a>. Required inside a card that is itself
   * one big <Link> — an anchor nested in an anchor is invalid HTML and the
   * browser silently un-nests it, which breaks both links.
   */
  asButton?: boolean;
}) {
  const href = googleDirectionsUrl(destination);

  // Nothing to navigate to — no coordinates, no address. A Directions button
  // that opens an empty map is worse than no button.
  if (!href) return null;

  // Google's own directions blue (#1a73e8), the colour people have been
  // trained on by Maps itself — so the control reads as "this takes me to a
  // map" before anyone reads the word. Same blue in all three forms; only the
  // weight changes with the surface.
  const styles =
    variant === "pill"
      ? "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-[#1a73e8] px-3.5 py-2 text-[13px] font-medium text-white transition hover:bg-[#1765cc]"
      : variant === "chip"
        // relative z-10: on a feed card the whole tile is a stretched link,
        // and without it this sits underneath and never receives the tap.
        ? "relative z-10 inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-[#1a73e8] px-2 py-0.5 text-[11px] font-semibold text-white shadow-sm transition hover:bg-[#1765cc]"
        : "inline-flex items-center gap-1.5 text-[13px] font-medium text-[#1a73e8] transition hover:text-[#1765cc]";

  const iconSize = variant === "chip" ? "h-3 w-3" : "h-4 w-4";

  const open = (e: React.MouseEvent) => {
    // The card around this may expand on click, or be a stretched link.
    // Getting directions should do exactly one thing.
    e.stopPropagation();
    const url = (prefersAppleMaps() && appleDirectionsUrl(destination)) || href;
    e.preventDefault();
    window.open(url, "_blank", "noopener");
  };

  const inner = (
    <>
      <Navigation className={iconSize} />
      {label}
    </>
  );

  if (asButton) {
    return (
      <button type="button" onClick={open} className={className ?? styles}>
        {inner}
      </button>
    );
  }

  return (
    <a href={href} target="_blank" rel="noopener noreferrer" onClick={open} className={className ?? styles}>
      {inner}
    </a>
  );
}
