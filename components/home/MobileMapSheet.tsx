"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { X } from "lucide-react";
import type { MapPoint } from "@/components/home/split-types";

const SplitMapInner = dynamic(() => import("./SplitMapInner"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-stone-100" />,
});

/**
 * The phone view of an expanded category: a full-screen map with a draggable
 * sheet of listings over it.
 *
 * This replaced a Show map / Show list toggle — two modes you flip between,
 * where seeing a place on the map and reading about it were mutually
 * exclusive. The sheet is the arrangement every maps app has converged on
 * because it dissolves that choice: the list and the map are on screen at the
 * same time and you decide the ratio by dragging.
 *
 * Three snap points, and each answers a different question:
 *   peek — "what's around here?"        the map has the screen, the sheet is a handle
 *   half — "what are these places?"     both, the default on arrival
 *   full — "let me actually read"       the list has the screen
 *
 * Behaviours that make it feel native rather than like a div that moves:
 *  - Taking hold of the MAP drops the sheet to `peek`. You reached past the
 *    sheet, so it gets out of the way without being told.
 *  - Tapping a pin selects it: the sheet drops to `peek` and shows that one
 *    card, the way Maps does. Dismissing it returns the full list.
 *  - The list only scrolls at `full`. Below that a drag on the list moves the
 *    SHEET, which is what the gesture means when the list is half off-screen.
 */

type Snap = "peek" | "half" | "full";

// Fractions of the sheet container's height that remain VISIBLE at each snap.
const VISIBLE: Record<Snap, number> = { peek: 0.14, half: 0.5, full: 0.94 };

export function MobileMapSheet({
  ids,
  points,
  renderCard,
  label,
}: {
  ids: string[];
  points: MapPoint[];
  renderCard: (id: string) => React.ReactNode;
  label: string;
}) {
  const [snap, setSnap] = useState<Snap>("half");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Once the reader has moved the map, stop refitting it to the pins — a
  // viewport that springs back after every pan is a map you can't use.
  const [autoFit, setAutoFit] = useState(true);

  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  // Live offset while a finger is down; null when settled on a snap point.
  const [dragY, setDragY] = useState<number | null>(null);
  const drag = useRef<{ startY: number; startTop: number } | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => setHeight(el.clientHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const topFor = useCallback((s: Snap) => height * (1 - VISIBLE[s]), [height]);
  const top = dragY ?? topFor(snap);

  const onMapInteract = useCallback(() => {
    setAutoFit(false);
    setSnap("peek");
    setSelectedId(null);
  }, []);

  const onSelect = useCallback((id: string) => {
    setSelectedId(id);
    setSnap("peek");
  }, []);

  // ── Dragging ──────────────────────────────────────────────────────────────
  const startDrag = (e: React.PointerEvent) => {
    // At `full` the list owns vertical drags UNLESS it is already scrolled to
    // the top — otherwise you could never scroll the list back up without
    // dragging the whole sheet down with it.
    if (snap === "full" && listRef.current && listRef.current.scrollTop > 0) return;
    drag.current = { startY: e.clientY, startTop: topFor(snap) };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const moveDrag = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const next = drag.current.startTop + (e.clientY - drag.current.startY);
    // Clamped so it can't be flung past either end and leave a gap.
    setDragY(Math.max(topFor("full"), Math.min(topFor("peek"), next)));
  };

  const endDrag = () => {
    if (!drag.current) return;
    const settled = dragY ?? drag.current.startTop;
    drag.current = null;
    setDragY(null);
    // Snap to whichever point the sheet was left nearest.
    const nearest = (["peek", "half", "full"] as Snap[]).reduce((best, s) =>
      Math.abs(topFor(s) - settled) < Math.abs(topFor(best) - settled) ? s : best,
    );
    setSnap(nearest);
  };

  const selected = selectedId && ids.includes(selectedId) ? selectedId : null;

  return (
    <div
      ref={containerRef}
      className="fixed inset-x-0 overflow-hidden"
      style={{
        top: "calc(var(--top-nav) + env(safe-area-inset-top))",
        // Stops above the tab bar rather than under it — the bar stays usable.
        bottom: "calc(3.25rem + env(safe-area-inset-bottom))",
      }}
    >
      <div className="absolute inset-0">
        <SplitMapInner
          points={points}
          hoveredId={selectedId}
          onHover={() => {}}
          onSelect={onSelect}
          onInteract={onMapInteract}
          fit={autoFit}
        />
      </div>

      {/* The sheet */}
      <div
        className="absolute inset-x-0 bottom-0 flex flex-col rounded-t-[var(--r-xl)] bg-white shadow-[0_-8px_32px_-8px_rgba(0,0,0,0.25)]"
        style={{
          top,
          // No transition while a finger is down, or the sheet lags the thumb.
          transition: dragY === null ? "top 280ms var(--ease)" : "none",
          touchAction: "none",
        }}
      >
        {/* Grab area — the handle and the title row both drag. */}
        <div
          onPointerDown={startDrag}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          className="shrink-0 cursor-grab active:cursor-grabbing"
        >
          <div className="flex justify-center pt-2.5">
            <div className="h-1 w-9 rounded-full bg-stone-300" />
          </div>
          <div className="flex items-center justify-between gap-2 px-4 pb-3 pt-2.5">
            <p className="t-strong truncate text-stone-900">
              {selected
                ? (points.find((p) => p.id === selected)?.title ?? "Place")
                : `${ids.length} in ${label}`}
            </p>
            {selected ? (
              <button
                onClick={() => setSelectedId(null)}
                aria-label="Back to the list"
                className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-stone-100 text-stone-600"
              >
                <X className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={() => setSnap(snap === "full" ? "peek" : "full")}
                className="shrink-0 t-meta font-semibold text-stone-500"
              >
                {snap === "full" ? "Map" : "List"}
              </button>
            )}
          </div>
        </div>

        {/* Contents. `overscroll-contain` so reaching the end of the list does
            not start scrolling the page behind the sheet. */}
        <div
          ref={listRef}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6"
          style={{ touchAction: snap === "full" ? "pan-y" : "none" }}
        >
          {selected ? (
            <div className="pt-1">{renderCard(selected)}</div>
          ) : (
            <div className="grid grid-cols-2 gap-x-4 gap-y-6 pt-1">
              {ids.map((id) => renderCard(id))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
