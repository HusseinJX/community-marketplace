"use client";

import { useCallback, useEffect, useState, type RefObject } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * The heading above a horizontal rail: the title (which opens the category)
 * and the scroll arrows.
 *
 * Shared by the Shops directory and the Events themes, so the two behave
 * identically rather than merely looking similar — the expand affordance, the
 * arrow disabling and the pointer-only rule are one implementation.
 */
export function RailHeader({
  emoji,
  label,
  count,
  scrollerRef,
  onExpand,
}: {
  emoji: string;
  label: string;
  count: number;
  scrollerRef: RefObject<HTMLDivElement | null>;
  onExpand: () => void;
}) {
  // Which arrows to draw. A left arrow at the start of a rail, or a right one
  // at the end, is a control that does nothing when pressed.
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const measure = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 1);
    // -1 for sub-pixel widths: on a fractional layout scrollLeft never quite
    // reaches the exact difference, and the right arrow would never retire.
    setAtEnd(el.scrollLeft >= el.scrollWidth - el.clientWidth - 1);
  }, [scrollerRef]);

  useEffect(() => {
    measure();
    const el = scrollerRef.current;
    if (!el) return;
    el.addEventListener("scroll", measure, { passive: true });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", measure);
      ro.disconnect();
    };
  }, [measure, scrollerRef, count]);

  // One "page" is the visible width less a card's worth, so the card you were
  // half-looking at stays on screen as an anchor instead of jumping away.
  const page = (dir: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(el.clientWidth - 260, 240), behavior: "smooth" });
  };

  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      {/* The heading IS the way in. A category you can see 25 of but only reach
          5 of is a dead end — this opens the split list/map view for all of
          them. The arrow is the affordance; the whole row is the target,
          because a 14px chevron is not something you aim at. */}
      <button
        onClick={onExpand}
        className="group flex min-w-0 items-center gap-2 text-left text-lg font-semibold tracking-tight text-stone-900"
      >
        <span className="text-xl leading-none">{emoji}</span>
        <span className="truncate">{label}</span>
        <span className="shrink-0 rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-500">
          {count}
        </span>
        <ChevronRight className="h-5 w-5 shrink-0 text-stone-400 transition group-hover:translate-x-0.5 group-hover:text-stone-900" />
      </button>

      {/* Above the rail's top edge and right-aligned — where a horizontal
          shelf's controls go. Pointer-only: a touch device scrolls the rail by
          dragging it, so these would duplicate a gesture that already works
          and steal space from the heading. */}
      <div className="pointer-only shrink-0 items-center gap-1.5">
        <Arrow dir="left" disabled={atStart} onClick={() => page(-1)} />
        <Arrow dir="right" disabled={atEnd} onClick={() => page(1)} />
      </div>
    </div>
  );
}

function Arrow({
  dir,
  disabled,
  onClick,
}: {
  dir: "left" | "right";
  disabled: boolean;
  onClick: () => void;
}) {
  const Icon = dir === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={dir === "left" ? "Scroll left" : "Scroll right"}
      className="grid h-8 w-8 place-items-center rounded-full border border-stone-300 bg-white text-stone-700 transition hover:border-stone-900 hover:shadow-[var(--shadow-float)] disabled:pointer-events-none disabled:opacity-30"
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}
