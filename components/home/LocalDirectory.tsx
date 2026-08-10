"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Loader2, LocateFixed } from "lucide-react";
import type { Member } from "@/lib/types";
import { MemberCard } from "@/components/MemberCard";
import { groupMembers } from "@/lib/browse-groups";
import { useDirectory } from "@/lib/data-hooks";
import { useHomePosition, refreshHomePosition, type Position } from "@/lib/home-position";
import { byDistance, milesTo } from "@/lib/proximity";

// Lean directory for the single home page: grouped rails of who's local.
// No search / category tabs / map / facets — just find who's local and tap.
//
// Nearest first is the DEFAULT, not something to opt into: the position comes
// from the shared home cache (one lookup, one permission dialog for the whole
// home screen) and the grid paints immediately, re-sorting when it arrives.
// "Near me" adds only one thing on top of that — hide anything past a radius.
//
// Facet filtering deliberately does NOT live here. It already lives in the
// search bar's FilterSidebar directly above, which carries size/ownership to
// /explore; a second set of facet pills on the same screen could disagree with
// it. Distance is the one axis this surface owns.
export function LocalDirectory({
  /** Sits on the heading row, right-aligned (the marketplace button). */
  headerAction,
  /** One line under the heading — the "own a local business?" prompt. */
  belowHeader,
}: {
  headerAction?: ReactNode;
  belowHeader?: ReactNode;
} = {}) {
  // Shared, server-cached directory (same key as /explore — one request, cached
  // across tab switches, and the connector call runs server-side not in-browser).
  const { members } = useDirectory();
  const { position, settled } = useHomePosition();

  // A local override so the "turn on location" button can supply a fresh fix
  // without waiting for the shared cache's next read.
  const [fresh, setFresh] = useState<Position | null>(null);
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  const home = fresh ?? position;

  const visible = useMemo(() => members.filter((m) => m.profile?.name), [members]);

  // Measure once, then sort and filter off the measurement — never recompute a
  // haversine inside a comparator.
  const measured = useMemo(
    () => visible.map((m) => ({ m, miles: milesTo(home, m.profile) })),
    [visible, home],
  );

  const ranked = useMemo(() => {
    if (!home) return measured;
    return [...measured].sort((a, b) => byDistance(a.miles, b.miles));
  }, [measured, home]);

  const milesById = useMemo(() => {
    const map = new Map<string, number | null>();
    for (const d of ranked) map.set(d.m.id, d.miles);
    return map;
  }, [ranked]);

  const groups = useMemo(() => groupMembers(ranked.map((d) => d.m)), [ranked]);

  async function requestLocation() {
    setLocating(true);
    setGeoError(null);
    try {
      // Refresh rather than read: this button exists because the person wants
      // a location NOW, so a refusal we remembered is the wrong answer.
      setFresh(await refreshHomePosition());
    } catch {
      setGeoError("Couldn't get your location. Check location permissions.");
    } finally {
      setLocating(false);
    }
  }

  return (
    <section className="mx-auto max-w-6xl border-t border-stone-100 px-4 pb-12 pt-8 md:px-8">
      {/* The floor, not the pitch — a plain way to browse everyone. */}
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold tracking-tight text-stone-900">
          Browse all local businesses
        </h2>
        {headerAction}
      </div>

      {/* "Near me" and its radius slider are gone, along with the "Nearest
          first" caption that restated them. Nearest-first is the default and
          every card prints its own distance, so the row was a control for
          hiding things plus a line explaining a sort that is already visible.
          Only the actionable half survives: an offer to turn location on. */}
      {belowHeader}

      {!home && settled && (
        <button
          type="button"
          onClick={() => void requestLocation()}
          disabled={locating}
          className="mt-2 inline-flex items-center gap-1 text-xs text-indigo-600 underline underline-offset-2 hover:text-indigo-800 disabled:opacity-60"
        >
          {locating ? <Loader2 className="h-3 w-3 animate-spin" /> : <LocateFixed className="h-3 w-3" />}
          Turn on location to sort by distance
        </button>
      )}

      {geoError && <p className="mb-3 mt-2 text-xs text-amber-700">{geoError}</p>}

      <div className="mt-4" />

      {visible.length === 0 ? (
        <p className="text-sm text-stone-400">No one local to show yet.</p>
      ) : (
        <div className="space-y-7">
          {groups.map(({ group, members: gm }) => (
            <Rail
              key={group.key}
              label={group.label}
              emoji={group.emoji}
              members={gm}
              milesById={milesById}
              hasPosition={!!home}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function Rail({
  label,
  emoji,
  members,
  milesById,
  hasPosition,
}: {
  label: string;
  emoji: string;
  members: Member[];
  milesById: Map<string, number | null>;
  hasPosition: boolean;
}) {
  return (
    <div>
      <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold tracking-tight text-stone-900">
        <span className="text-xl leading-none">{emoji}</span>
        {label}
        <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-500">{members.length}</span>
      </h3>
      <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:-mx-8 md:px-8">
        {members.map((m) => (
          <div key={m.id} className="w-60 shrink-0 sm:w-64">
            <MemberCard member={m} miles={milesById.get(m.id) ?? null} hasPosition={hasPosition} />
          </div>
        ))}
      </div>
    </div>
  );
}
