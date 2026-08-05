"use client";

import { useMemo, useState } from "react";
import { Loader2, LocateFixed, MapPin } from "lucide-react";
import type { Member } from "@/lib/types";
import { MemberCard } from "@/components/MemberCard";
import { groupMembers } from "@/lib/browse-groups";
import { useDirectory } from "@/lib/data-hooks";
import { useHomePosition, refreshHomePosition, type Position } from "@/lib/home-position";
import { byDistance, milesTo, RADIUS_STEPS } from "@/lib/proximity";

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
export function LocalDirectory() {
  // Shared, server-cached directory (same key as /explore — one request, cached
  // across tab switches, and the connector call runs server-side not in-browser).
  const { members } = useDirectory();
  const { position, settled } = useHomePosition();

  // A local override so the "turn on location" button can supply a fresh fix
  // without waiting for the shared cache's next read.
  const [fresh, setFresh] = useState<Position | null>(null);
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [nearMe, setNearMe] = useState(false);
  const [radius, setRadius] = useState(2);

  const home = fresh ?? position;

  const visible = useMemo(() => members.filter((m) => m.profile?.name), [members]);

  // Measure once, then sort and filter off the measurement — never recompute a
  // haversine inside a comparator.
  const measured = useMemo(
    () => visible.map((m) => ({ m, miles: milesTo(home, m.profile) })),
    [visible, home],
  );

  const { ranked, hiddenUnplaced } = useMemo(() => {
    if (!home) return { ranked: measured, hiddenUnplaced: 0 };
    const sorted = [...measured].sort((a, b) => byDistance(a.miles, b.miles));
    if (!nearMe) return { ranked: sorted, hiddenUnplaced: 0 };
    // Inside a radius, anything we could not place is OUT. Passing it through
    // would make the filter a suggestion.
    const kept = sorted.filter((d) => d.miles != null && d.miles <= radius);
    const unplaced = sorted.filter((d) => d.miles == null).length;
    return { ranked: kept, hiddenUnplaced: unplaced };
  }, [measured, home, nearMe, radius]);

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
      setNearMe(true);
    } catch {
      setGeoError("Couldn't get your location. Check location permissions.");
      setNearMe(false);
    } finally {
      setLocating(false);
    }
  }

  return (
    <section className="mx-auto max-w-6xl border-t border-stone-100 px-4 pb-12 pt-8 md:px-8">
      {/* The floor, not the pitch — a plain way to browse everyone. */}
      <h2 className="mb-3 text-xl font-semibold tracking-tight text-stone-900">
        Browse all local businesses
      </h2>

      {/* One row, one axis. Sized like every other pill in the app
          (px-4 py-1.5 text-sm) so the surfaces don't look stitched together. */}
      <div className="-mx-4 mb-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden">
        <button
          type="button"
          onClick={() => {
            if (!home) return void requestLocation();
            setNearMe(!nearMe);
          }}
          aria-pressed={nearMe}
          disabled={locating}
          className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-4 py-1.5 text-sm font-medium disabled:opacity-60 ${
            nearMe
              ? "border-indigo-600 bg-indigo-600 text-white"
              : "border-stone-200 bg-white text-stone-600 hover:border-stone-400"
          }`}
        >
          {locating ? <Loader2 className="h-3 w-3 animate-spin" /> : <LocateFixed className="h-3 w-3" />}
          Near me
        </button>

        {nearMe && home && (
          <div className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap text-xs text-stone-500">
            <span>within</span>
            <input
              type="range"
              min={0}
              max={RADIUS_STEPS.length - 1}
              step={1}
              value={RADIUS_STEPS.indexOf(radius)}
              onChange={(e) => setRadius(RADIUS_STEPS[Number(e.target.value)])}
              aria-label="Distance in miles"
              className="w-24 accent-indigo-600"
            />
            <b className="font-mono text-stone-800">{radius} mi</b>
          </div>
        )}

        {home ? (
          <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-xs text-stone-500">
            <MapPin className="h-3 w-3 text-emerald-600" />
            Nearest first
          </span>
        ) : settled ? (
          <button
            type="button"
            onClick={() => void requestLocation()}
            className="shrink-0 whitespace-nowrap text-xs text-indigo-600 underline underline-offset-2 hover:text-indigo-800"
          >
            Turn on location to sort by distance
          </button>
        ) : null}
      </div>

      {geoError && <p className="mb-3 text-xs text-amber-700">{geoError}</p>}

      {visible.length === 0 ? (
        <p className="text-sm text-stone-400">No one local to show yet.</p>
      ) : ranked.length === 0 ? (
        <p className="text-sm text-stone-500">
          Nothing within {radius} mi. Try widening the distance.
        </p>
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

      {/* Said out loud rather than quietly dropped — otherwise a short list
          looks like the neighbourhood is empty. */}
      {hiddenUnplaced > 0 && (
        <p className="mt-6 text-xs text-stone-400">
          {hiddenUnplaced} {hiddenUnplaced === 1 ? "business has" : "businesses have"} no location
          on file and {hiddenUnplaced === 1 ? "isn't" : "aren't"} shown while “Near me” is on.
        </p>
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
