"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import { Loader2, LocateFixed } from "lucide-react";
import type { Member } from "@/lib/types";
import { MemberCard } from "@/components/MemberCard";
import { CategorySplit } from "@/components/home/CategorySplit";
import { memberPoint } from "@/lib/map-adapters";
import { RailHeader } from "@/components/home/RailHeader";
import { groupMembers } from "@/lib/browse-groups";
import { useDirectory } from "@/lib/data-hooks";
import { hasMemberImage } from "@/lib/member-images";
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
// What a typed keyword is matched against. Lowercased once per member per
// keystroke — the directory is a few hundred rows held in memory, so this is a
// substring scan and never a request.
function memberHaystack(m: Member): string {
  const p = m.profile ?? {};
  const parts: unknown[] = [
    p.name,
    p.businessName,
    p.category,
    p.subcategory,
    p.businessCategory,
    p.businessType,
    p.neighborhood,
    p.services,
    p.specialties,
    p.menuHighlights,
    p.products,
  ];
  const out: string[] = [];
  for (const v of parts) {
    if (typeof v === "string") out.push(v);
    else if (Array.isArray(v)) for (const x of v) if (typeof x === "string") out.push(x);
  }
  return out.join(" ").toLowerCase();
}

export function LocalDirectory({
  /** Sits on the heading row, right-aligned (the marketplace button). */
  headerAction,
  /** One line under the heading — the "own a local business?" prompt. */
  belowHeader,
  /**
   * Draw the "Browse all local businesses" title.
   *
   * Off on the Shops tab: the tab selector directly above already says Shops,
   * the city name says where, and each rail carries its own heading — so the
   * title was a third label for a thing already named twice, sitting between
   * the reader and the first photo.
   */
  showHeading = true,
  /**
   * A keyword from the header search. Non-empty replaces the category rails
   * with one flat, nearest-first grid of everything that matches — the rails
   * are a way to browse when you don't know what you want, and once you've
   * typed a word you do.
   */
  query = "",
}: {
  headerAction?: ReactNode;
  belowHeader?: ReactNode;
  showHeading?: boolean;
  query?: string;
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

  // A named business WITH a photo. This surface is a wall of image tiles, and
  // a business with nothing to show renders as a coloured gradient with a name
  // on it — which reads as a broken card rather than as a listing, and puts the
  // least appealing thing on the shelf next to businesses that did the work.
  // Hidden here rather than dropped from the data: it is still findable by
  // search and still has a profile page; it just doesn't get a tile until it
  // has something to put in it. `hasMemberImage` is the same list MemberCard
  // draws from, so the two can never disagree.
  //
  // While SEARCHING that photo rule is lifted: someone typing a name is after
  // one specific business, and "we have it but won't show it to you because it
  // has no picture" is the wrong answer to a name typed in full. Browsing is a
  // shelf; searching is a lookup.
  const q = query.trim().toLowerCase();
  const searching = q.length > 0;

  const visible = useMemo(
    () =>
      members.filter(
        (m) => m.profile?.name && (searching || hasMemberImage(m)),
      ),
    [members, searching],
  );

  // Name first, then what the business IS — so "bakery" finds the bakeries and
  // "Tartine" finds Tartine. Same fields the category rails bucket on, so a
  // word that names a rail also finds its members.
  const matched = useMemo(() => {
    if (!searching) return visible;
    return visible.filter((m) => memberHaystack(m).includes(q));
  }, [visible, searching, q]);

  // Measure once, then sort and filter off the measurement — never recompute a
  // haversine inside a comparator.
  const measured = useMemo(
    () => matched.map((m) => ({ m, miles: milesTo(home, m.profile) })),
    [matched, home],
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

  // Which category is expanded into the list+map split, by group key.
  const [expanded, setExpanded] = useState<string | null>(null);
  // A search outranks an open category: the results are drawn from every
  // category, so staying inside one would silently drop most of them.
  const open = expanded && !searching ? groups.find((g) => g.group.key === expanded) : undefined;

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

  // An expanded category replaces the shelf entirely rather than appearing
  // beneath it: you asked for one category, so the other nine rails are not
  // context any more, they are noise you have to scroll past to reach the map.
  if (open) {
    const byId = new Map(open.members.map((m) => [m.id, m]));
    return (
      <CategorySplit
        label={open.group.label}
        emoji={open.group.emoji}
        backLabel="All shops"
        ids={open.members.map((m) => m.id)}
        points={open.members.flatMap((m) => memberPoint(m) ?? [])}
        renderCard={(id, { linked, onHover }) => {
          const m = byId.get(id);
          if (!m) return null;
          return (
            <MemberCard
              key={m.id}
              member={m}
              miles={milesById.get(m.id) ?? null}
              hasPosition={!!home}
              linked={linked}
              onHover={onHover}
            />
          );
        }}
        onBack={() => setExpanded(null)}
      />
    );
  }

  return (
    // No top rule: on the Shop tab this is the first section under the city
    // name, so the divider read as a line drawn under the page title rather
    // than as a separator between two things.
    <section className="mx-auto max-w-6xl px-4 pb-12 pt-6 md:px-8">
      {/* The floor, not the pitch — a plain way to browse everyone. */}
      {(showHeading || headerAction) && (
        <div className="mb-2 flex items-center justify-between gap-3">
          {showHeading ? (
            <h2 className="t-section text-stone-900">Browse all local businesses</h2>
          ) : (
            <span />
          )}
          {headerAction}
        </div>
      )}

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
          className="mt-2 inline-flex items-center gap-1 t-meta text-stone-600 underline underline-offset-2 hover:text-coral-700 disabled:opacity-60"
        >
          {locating ? <Loader2 className="h-3 w-3 animate-spin" /> : <LocateFixed className="h-3 w-3" />}
          Turn on location to sort by distance
        </button>
      )}

      {geoError && <p className="mb-3 mt-2 text-xs text-amber-700">{geoError}</p>}

      <div className="mt-4" />

      {searching ? (
        // One flat grid, still nearest-first. Same card as the rails draw, so a
        // result and a shelf tile are the same object.
        ranked.length === 0 ? (
          <p className="t-body text-stone-400">
            No local businesses match “{query.trim()}”.
          </p>
        ) : (
          <>
            <p className="mb-3 t-meta text-stone-500">
              {ranked.length} {ranked.length === 1 ? "business" : "businesses"} matching “
              {query.trim()}”
            </p>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
              {ranked.map(({ m, miles }) => (
                <MemberCard key={m.id} member={m} miles={miles} hasPosition={!!home} />
              ))}
            </div>
          </>
        )
      ) : visible.length === 0 ? (
        <p className="t-body text-stone-400">No one local to show yet.</p>
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
              onExpand={() => {
                setExpanded(group.key);
                window.scrollTo({ top: 0 });
              }}
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
  onExpand,
}: {
  label: string;
  emoji: string;
  members: Member[];
  milesById: Map<string, number | null>;
  hasPosition: boolean;
  onExpand: () => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);

  return (
    <div>
      <RailHeader
        emoji={emoji}
        label={label}
        count={members.length}
        scrollerRef={scroller}
        onExpand={onExpand}
      />
      <div
        ref={scroller}
        className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:-mx-8 md:px-8"
      >
        {members.map((m) => (
          <div key={m.id} className="w-60 shrink-0 sm:w-64">
            <MemberCard member={m} miles={milesById.get(m.id) ?? null} hasPosition={hasPosition} />
          </div>
        ))}
      </div>
    </div>
  );
}
