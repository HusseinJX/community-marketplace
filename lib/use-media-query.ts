"use client";

import { useEffect, useState } from "react";

/**
 * Match a media query in JS, for the cases where `hidden lg:block` is not good
 * enough — that is, whenever the two branches would each MOUNT something
 * expensive.
 *
 * Tailwind's responsive classes render both branches and hide one with CSS.
 * That is right for text and wrong for anything that costs something to exist:
 * a hidden grid of 25 listing cards still creates 25 `next/image` elements and
 * still fetches their sources, and a hidden Leaflet map still builds a whole
 * map and pulls its tiles. Decoded bitmaps are what killed the iOS WKWebView
 * content process once already (see the MEMORY LEVER notes in ImageCarousel),
 * so a silently-duplicated grid is not a cosmetic waste.
 *
 * Starts `false` on the server and on first paint, then corrects in an effect.
 * That ordering is deliberate: the mobile branch is the cheaper one, so the
 * pre-hydration render is the small one either way.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(query);
    setMatches(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

/** The `lg` breakpoint — where the split view gains room for a second pane. */
export function useIsDesktop(): boolean {
  return useMediaQuery("(min-width: 1024px)");
}

/** The `md` breakpoint — where the bottom tab bar gives way to the header. */
export function useIsMdUp(): boolean {
  return useMediaQuery("(min-width: 768px)");
}
