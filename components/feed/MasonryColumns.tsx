"use client";

import { Fragment, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useMediaQuery } from "@/lib/use-media-query";

// Pinterest-style columns that only ever GROW at the bottom.
//
// Why not CSS `columns`: it re-splits every card whenever one is added, so
// "Load more" made cards already on screen jump between columns. Here each
// card is placed once — into whichever column is shortest at that moment — and
// keeps that column for good. More cards simply continue under the last card
// in each column. Placement resets only when the column count changes (the
// window crosses a breakpoint), because a 3-column layout means nothing in 2.
export function MasonryColumns({ items }: { items: { key: string; node: ReactNode }[] }) {
  const isSm = useMediaQuery("(min-width: 640px)");
  const isLg = useMediaQuery("(min-width: 1024px)");
  const cols = isLg ? 3 : isSm ? 2 : 1;

  const colRefs = useRef<(HTMLDivElement | null)[]>([]);
  // key → column, kept across renders so a placed card never moves.
  const placed = useRef<{ cols: number; at: Map<string, number> }>({ cols, at: new Map() });
  const [, bump] = useState(0);

  if (placed.current.cols !== cols) placed.current = { cols, at: new Map() };

  // Cards not placed yet are held back for one layout pass: measured columns
  // first, then each newcomer goes to the shortest, one at a time.
  const pending = items.filter((it) => !placed.current.at.has(it.key));

  useLayoutEffect(() => {
    if (!pending.length) return;
    const heights = Array.from({ length: cols }, (_, c) => colRefs.current[c]?.offsetHeight ?? 0);
    // Newcomers have no height until they render; a typical card height keeps
    // a batch from all landing in the same column.
    const placedEls = colRefs.current.flatMap((el) => (el ? [...el.children] : [])) as HTMLElement[];
    const typical = placedEls.length
      ? placedEls.reduce((s, el) => s + el.offsetHeight, 0) / placedEls.length
      : 400;
    for (const it of pending) {
      const c = heights.indexOf(Math.min(...heights));
      placed.current.at.set(it.key, c);
      heights[c] += typical;
    }
    bump((n) => n + 1);
  });

  return (
    <div className="flex items-start gap-4">
      {Array.from({ length: cols }, (_, c) => (
        <div key={c} ref={(el) => { colRefs.current[c] = el; }} className="flex min-w-0 flex-1 flex-col gap-4">
          {items
            .filter((it) => placed.current.at.get(it.key) === c)
            .map((it) => (
              <Fragment key={it.key}>{it.node}</Fragment>
            ))}
        </div>
      ))}
    </div>
  );
}
