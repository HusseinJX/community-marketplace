"use client";

import { useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { ArrowLeft } from "lucide-react";
import { MobileMapSheet } from "@/components/home/MobileMapSheet";
import { useIsDesktop } from "@/lib/use-media-query";
import type { MapPoint } from "@/components/home/split-types";

const SplitMapInner = dynamic(() => import("./SplitMapInner"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse rounded-[var(--r-lg)] bg-stone-100" />,
});

/**
 * An expanded category: the listings on the left, the map on the right.
 *
 * Generic over what it is showing — shops and events both use it, supplying
 * their own `MapPoint` adapter and card renderer. Before that it was typed to
 * Member, and adding events would have meant a second copy differing only in
 * which object it read `lat` off.
 *
 * ── Why this lives on the EXPANDED category and not on the tab ───────────────
 * The browse index is a shelf you skim — rails of photographs, no commitment.
 * A map there would be answering a question nobody has asked yet. Once you
 * open a category you have said what you want, and the only question left is
 * *where*, which is exactly what a map answers.
 *
 * ── Desktop vs phone ─────────────────────────────────────────────────────────
 * Desktop gets both panes at once: the list scrolls, the map is sticky beside
 * it. There is no room for that on a phone, so it becomes a full-screen map
 * with a draggable sheet over it — see MobileMapSheet.
 *
 * The hover pairing is owned HERE, because it is the one piece of state both
 * panes need. Neither child may own it: whichever did would have to push
 * changes sideways into its sibling.
 */
export function CategorySplit({
  label,
  emoji,
  ids,
  points,
  renderCard,
  onBack,
  backLabel,
}: {
  label: string;
  emoji: string;
  /** Every row in the category, in display order — including unmappable ones. */
  ids: string[];
  /** The subset that has a position. */
  points: MapPoint[];
  renderCard: (id: string, opts: { linked: boolean; onHover: (id: string | null) => void }) => ReactNode;
  onBack: () => void;
  backLabel: string;
}) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const isDesktop = useIsDesktop();

  return (
    <section className="mx-auto max-w-6xl px-4 pb-12 pt-4 md:px-8">
      {/* Master-detail: the category becomes the title, with a back link that
          names where it goes. Same shape as every other detail view here. */}
      <button
        onClick={onBack}
        className="mb-3 inline-flex items-center gap-1.5 t-meta text-stone-500 transition hover:text-stone-900"
      >
        <ArrowLeft className="h-4 w-4" />
        {backLabel}
      </button>

      <div className="mb-4 flex items-center gap-2">
        <span className="text-xl leading-none">{emoji}</span>
        <h2 className="t-section text-stone-900">{label}</h2>
        <span className="rounded-full bg-stone-100 px-2 py-0.5 t-fine text-stone-500">
          {ids.length}
        </span>
      </div>

      {/* ── Desktop: list left, map right ───────────────────────────────────
          Branched in JS, not with `hidden lg:grid`. Tailwind's version renders
          BOTH branches and hides one, which here meant a second full grid of
          cards and a second Leaflet map existing off-screen — every image
          fetched and decoded. That is the exact shape that OOM'd the iOS
          webview once already.

          EQUAL HALVES via `minmax(0,1fr)` twice rather than `1fr 1fr`: a bare
          1fr floors at its content's min width, so the widest name would push
          the left column past its share and squeeze the map. */}
      {isDesktop ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          {/* One column at lg, two at xl: half of a 1440px container is ~560px,
              and two cards in that leaves each narrower than a phone renders
              them. */}
          <div className="grid grid-cols-1 gap-x-4 gap-y-7 xl:grid-cols-2">
            {ids.map((id) => renderCard(id, { linked: hoveredId === id, onHover: setHoveredId }))}
          </div>

          {/* Sticky, and as tall as the viewport under the header — a map that
              scrolls away is a map you have to keep scrolling back to. */}
          <div
            className="sticky h-[calc(100dvh-9rem)] overflow-hidden rounded-[var(--r-lg)] border border-stone-200"
            style={{ top: "calc(var(--top-nav) + 1.5rem + env(safe-area-inset-top))" }}
          >
            <SplitMapInner points={points} hoveredId={hoveredId} onHover={setHoveredId} />
          </div>
        </div>
      ) : (
        <MobileMapSheet
          ids={ids}
          points={points}
          renderCard={(id) => renderCard(id, { linked: false, onHover: () => {} })}
          label={label}
        />
      )}
    </section>
  );
}
