"use client";

import { useEffect, useState } from "react";
import { MapPin, X } from "lucide-react";
import {
  DEV_LOCATION_ENABLED,
  DEV_PLACES,
  devLocation,
  writeDevLocation,
  type DevLocation,
} from "@/lib/dev-location";
import { clearStoredPosition, setCityOverride } from "@/lib/home-position";

/**
 * Dev-only: browse the site as if you were somewhere else.
 *
 * Mounted from the root layout, and it renders NOTHING in a production build —
 * see DEV_LOCATION_ENABLED. Bottom-left, above the bottom nav's safe area,
 * because the right side is where real controls live and this must never be
 * mistaken for one.
 */
export function DevLocationToggle() {
  const [open, setOpen] = useState(false);
  // Read AFTER mount, never during render.
  //
  // localStorage does not exist on the server, so reading it in the render body
  // made the server produce "Real location" and the client produce "New York" —
  // a hydration mismatch, which React answers by throwing away the server tree
  // and re-rendering the whole page on the client. That is what surfaced the
  // second error too: re-rendering the tree walks the inline theme <script> in
  // the root layout, which is legal to SSR and not legal to render client-side.
  // One bug, two messages.
  const [current, setCurrent] = useState<DevLocation | null>(null);
  useEffect(() => {
    setCurrent(devLocation());
  }, []);

  if (!DEV_LOCATION_ENABLED) return null;

  function pick(loc: DevLocation | null) {
    writeDevLocation(loc);
    // Both caches would otherwise outrank the new answer. The stored fix is
    // read before anything asks the device at all, and a city override was a
    // deliberate "show me Oakland" that has nothing to do with pretending to
    // BE in Oakland — leaving it set would mix the two simulations together.
    clearStoredPosition();
    setCityOverride(null);
    // A reload rather than a broadcast: half of this state is cached at module
    // scope across a dozen files, and "which caches did I miss" is exactly the
    // question a debugging tool must not make you ask.
    window.location.reload();
  }

  return (
    <div className="pointer-events-none fixed bottom-0 left-0 z-[60] p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:pb-3">
      {open && (
        <div className="pointer-events-auto mb-2 max-h-[60vh] w-64 overflow-y-auto rounded-2xl border border-stone-200 bg-white p-1.5 shadow-[var(--shadow-overlay)]">
          <div className="flex items-center justify-between px-2.5 py-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">
              Browse as if in…
            </span>
            <button onClick={() => setOpen(false)} className="text-stone-400 hover:text-stone-700">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <button
            onClick={() => pick(null)}
            className={
              "block w-full rounded-xl px-2.5 py-2 text-left text-[13px] " +
              (current ? "text-stone-700 hover:bg-stone-50" : "bg-stone-900 font-semibold text-white")
            }
          >
            My real location
          </button>
          {DEV_PLACES.map((p) => {
            const on = !!current && current.label === p.label;
            return (
              <button
                key={p.label}
                onClick={() => pick(p)}
                className={
                  "block w-full rounded-xl px-2.5 py-2 text-left text-[13px] " +
                  (on ? "bg-stone-900 font-semibold text-white" : "text-stone-700 hover:bg-stone-50")
                }
              >
                {p.label}
              </button>
            );
          })}
          <p className="px-2.5 py-2 text-[11px] leading-relaxed text-stone-400">
            Replaces the device fix everywhere — distance sort, event ranking,
            map pin, post location. Dev builds only.
          </p>
        </div>
      )}

      {/* Amber and always visible while pretending: a simulated location you
          forgot you set explains an afternoon of "why is this empty". */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={
          "pointer-events-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold shadow-[var(--shadow-float)] " +
          (current ? "bg-amber-500 text-white" : "bg-stone-900/85 text-white")
        }
        title="Dev: simulate location"
      >
        <MapPin className="h-3.5 w-3.5" />
        {current ? current.label : "Real location"}
      </button>
    </div>
  );
}
