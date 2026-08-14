"use client";

import { usePathname } from "next/navigation";
import { TopNav } from "@/components/TopNav";

/**
 * The sticky app header.
 *
 * Exists as its own client component for one reason: whether it draws a bottom
 * rule depends on what is under it.
 *
 * On home, the search bar sits in a sticky band directly beneath this, and the
 * rule belongs under THAT — one line closing the whole header, not two lines
 * with the search sandwiched between them. Everywhere else there is no band,
 * so the header draws its own rule as before.
 *
 * The alternative — dropping the border globally — would leave every profile,
 * vendor and checkout page with a header floating on the background.
 */
export function AppHeader() {
  const pathname = usePathname();
  // Home is "/" for every tab: the tab lives in ?tab=, which pathname omits.
  //
  // The band below carries the rule in EVERY state — its border sits on the
  // sticky wrapper rather than on the folding content, so it survives the
  // collapse even when the wrapper folds to nothing. So this header never
  // draws one on home; doing so conditionally produced a double line on a
  // phone, where the tab row stays open and keeps its own edge.
  const hasSearchBandBelow = pathname === "/";

  return (
    <header
      className={
        "sticky top-0 z-30 " + (hasSearchBandBelow ? "" : "border-b border-stone-200")
      }
      style={{
        paddingTop: "env(safe-area-inset-top)",
        // The first segment of the shared header ramp (--hdr-* in globals.css).
        // Ends exactly on the colour the block below starts with, so the two
        // stacked elements read as one surface with no seam between them.
        background: "linear-gradient(to bottom, var(--hdr-1), var(--hdr-2))",
      }}
    >
      {/* Same container as the page body (max-w-6xl px-4 md:px-8, the padding
          lives in TopNav) so the wordmark lines up with the search bar and the
          content below it. */}
      <div className="mx-auto max-w-6xl">
        <TopNav />
      </div>
    </header>
  );
}
