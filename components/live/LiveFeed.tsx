"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { LayoutGrid, Map as MapIcon, Radio, RefreshCw } from "lucide-react";
import { groupByEvent, eventEmoji, eventLabel } from "@/lib/live-events";
import { BroadcastCard } from "./BroadcastCard";
import { MatchCard, type MatchGroup } from "./MatchCard";
import { LiveMap } from "./LiveMap";
import { getDemoBroadcasts } from "@/lib/demo-live";
import { fetchDemoLiveBroadcasts } from "@/lib/demo-live-fixtures";
import type { LiveBroadcast } from "./types";

type ViewMode = "feed" | "map";

export function LiveFeed({ afterHero, afterFeed }: { afterHero?: React.ReactNode; afterFeed?: React.ReactNode } = {}) {
  const [items, setItems] = useState<LiveBroadcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>("feed");
  const [event, setEvent] = useState<string>("all");
  const [team, setTeam] = useState<string>("all");
  // Deep-linked to one event (e.g. /live?event=world-cup = "where to watch the
  // World Cup"): lock to that event and drop the filter chips — just the cards.
  const [locked, setLocked] = useState(false);

  const load = useCallback(async () => {
    // Demo fallback: real live games (ESPN slate) populated with demo venues.
    // Falls back to the static demo only if nothing is live right now.
    const demo = async () => {
      const live = await fetchDemoLiveBroadcasts();
      return live.length ? live : getDemoBroadcasts();
    };
    try {
      const res = await fetch("/api/broadcasts");
      if (res.ok) {
        const data = await res.json();
        setItems(data.broadcasts?.length ? data.broadcasts : await demo());
      } else {
        setItems(await demo());
      }
    } catch {
      setItems(await demo());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    // Honor a ?event=<slug> deep link (e.g. from a live-event page).
    const q = new URLSearchParams(window.location.search).get("event");
    if (q) {
      setEvent(q);
      setLocked(true);
    }
    // Keep the feed fresh — broadcasts start and expire on their own.
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  // Event chips derived from what's actually live, in curated order.
  const groups = useMemo(() => groupByEvent(items), [items]);
  const eventFiltered = useMemo(
    () => (event === "all" ? items : items.filter((b) => b.event_slug === event)),
    [items, event]
  );
  // Team-allegiance chips, scoped to the selected event.
  const teamOptions = useMemo(
    () => Array.from(new Set(eventFiltered.map((b) => b.supports_team).filter(Boolean) as string[])).sort(),
    [eventFiltered]
  );
  const filtered = useMemo(
    () =>
      team === "all"
        ? eventFiltered
        : eventFiltered.filter((b) => (b.supports_team || "").toLowerCase() === team.toLowerCase()),
    [eventFiltered, team]
  );

  // Group broadcasts by match (the game), not by venue — one card per game, each
  // opening the list of places showing it.
  const matchGroups = useMemo<MatchGroup[]>(() => {
    const buckets = new Map<string, LiveBroadcast[]>();
    for (const b of filtered) {
      const key = (b.whats_on?.trim().toLowerCase() || `event:${b.event_slug}`);
      const arr = buckets.get(key) ?? [];
      arr.push(b);
      buckets.set(key, arr);
    }
    return Array.from(buckets.entries()).map(([key, venues]) => {
      const first = venues[0];
      return {
        key,
        title: first.whats_on || eventLabel(first.event_slug, first.event_label),
        event_slug: first.event_slug,
        event_label: first.event_label,
        cover: venues.find((v) => v.image_urls?.[0])?.image_urls[0],
        teams: Array.from(new Set(venues.map((v) => v.supports_team).filter(Boolean) as string[])),
        venues,
      };
    });
  }, [filtered]);

  return (
    <>
      {/* Contextual hero — only on a deep-linked single event ("Where to watch
          the World Cup in SF"). The generic feed view skips it. */}
      {locked && (
        <div className="mx-auto max-w-6xl px-4 md:px-8">
          <section className="relative -mx-4 mb-6 overflow-hidden rounded-b-[1.75rem] md:-mx-8 md:mt-6 md:rounded-[1.75rem]">
            <div className="absolute inset-0 bg-gradient-to-br from-rose-50 via-orange-50 to-amber-50" />
            <div className="absolute -left-16 -top-16 h-44 w-44 rounded-full bg-rose-300/40 blur-3xl" />
            <div className="absolute right-[-4rem] top-2 h-48 w-48 rounded-full bg-orange-300/40 blur-3xl" />
            <div className="relative px-6 py-7 md:py-9">
              <div className="mx-auto max-w-2xl text-center">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-600 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">
                  <Radio className="h-3 w-3" /> Where to watch
                </span>
                <h1 className="mt-3 text-2xl font-semibold tracking-tight text-stone-900 md:text-3xl">
                  {`Where to watch the ${eventLabel(event)} in SF`}
                </h1>
                <p className="mx-auto mt-2 max-w-lg text-sm text-stone-600">
                  The best watch parties in San Francisco — bars and venues showing every match, with the vibe and the crowd.
                </p>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* Events happening now / upcoming render here (passed by the page). */}
      {afterHero}

      <div className="mx-auto max-w-6xl border-t border-stone-100 px-4 pb-8 pt-8 md:px-8">
      {/* Live now — venue broadcasts. */}
      {!locked && (
        <h2 className="mb-3 text-xl font-semibold tracking-tight text-stone-900">Live now</h2>
      )}

      {/* Controls */}
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
          {/* Event filter chips — hidden on a deep-linked single-event view. */}
          {!locked && (
            <>
              <Chip active={event === "all"} onClick={() => { setEvent("all"); setTeam("all"); }}>
                All ({items.length})
              </Chip>
              {groups.map((g) => (
                <Chip key={g.slug} active={event === g.slug} onClick={() => { setEvent(g.slug); setTeam("all"); }}>
                  {eventEmoji(g.slug)} {eventLabel(g.slug, g.items[0]?.event_label)} ({g.items.length})
                </Chip>
              ))}
            </>
          )}
        </div>
        <div className="hidden shrink-0 items-center gap-2 sm:flex">
          <button
            onClick={load}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-stone-500 hover:bg-stone-100 hover:text-stone-900"
            aria-label="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          {/* Feed/Map toggle only on the focused single-event view (the rail
              feed has no map). */}
          {locked && (
            <div className="flex rounded-full border border-stone-200 bg-white p-1">
              <ToggleBtn active={view === "feed"} onClick={() => setView("feed")}>
                <LayoutGrid className="h-4 w-4" /> Feed
              </ToggleBtn>
              <ToggleBtn active={view === "map"} onClick={() => setView("map")}>
                <MapIcon className="h-4 w-4" /> Map
              </ToggleBtn>
            </div>
          )}
        </div>
      </div>

      {/* Team-allegiance filter — "find the bar rooting for your team" */}
      {!locked && teamOptions.length > 0 && (
        <div className="mb-5 -mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
          <span className="shrink-0 text-xs font-medium text-stone-400">Rooting for:</span>
          <Chip active={team === "all"} onClick={() => setTeam("all")}>
            Any team
          </Chip>
          {teamOptions.map((t) => (
            <Chip key={t} active={team === t} onClick={() => setTeam(t)}>
              🏳️ {t}
            </Chip>
          ))}
        </div>
      )}

      {/* Body */}
      {loading ? (
        locked ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-44 animate-pulse rounded-2xl bg-stone-100" />
            ))}
          </div>
        ) : (
          <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-2 md:-mx-8 md:px-8">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-64 w-72 shrink-0 animate-pulse rounded-2xl bg-stone-100 sm:w-80" />
            ))}
          </div>
        )
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white/60 p-12 text-center">
          <p className="text-base font-medium text-stone-800">Nothing live right now.</p>
          <p className="mt-1 text-sm text-stone-500">
            Check back around game time — venues broadcast what they&apos;re showing here.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white/60 p-12 text-center">
          <p className="text-base font-medium text-stone-800">No venues match that filter.</p>
          <p className="mt-1 text-sm text-stone-500">Try a different team or event.</p>
        </div>
      ) : locked ? (
        // Focused single-event view: full grid or map.
        view === "map" ? <LiveMap broadcasts={filtered} /> : <Grid items={filtered} lean />
      ) : (
        // Feed view: horizontal scroll rail — one card per match (game).
        <MatchRail groups={matchGroups} />
      )}
      </div>

      {afterFeed}
    </>
  );
}

function Grid({ items, lean = false }: { items: LiveBroadcast[]; lean?: boolean }) {
  return (
    <div className="grid auto-rows-fr grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((b) => (
        <BroadcastCard key={b.id} b={b} lean={lean} />
      ))}
    </div>
  );
}

// Horizontal scroll of live-venue cards (the home feed view).
// Horizontal scroll — one card per match (game). Tapping a card reveals the
// venues showing it.
function MatchRail({ groups }: { groups: MatchGroup[] }) {
  return (
    <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:-mx-8 md:px-8">
      {groups.map((g) => (
        <div key={g.key} className="w-72 shrink-0 sm:w-80">
          <MatchCard group={g} />
        </div>
      ))}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition " +
        (active
          ? "bg-rose-600 text-white"
          : "border border-stone-200 bg-white text-stone-700 hover:border-stone-300")
      }
    >
      {children}
    </button>
  );
}

function ToggleBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition " +
        (active ? "bg-rose-600 text-white" : "text-stone-600 hover:text-stone-900")
      }
    >
      {children}
    </button>
  );
}
