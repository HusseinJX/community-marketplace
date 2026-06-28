"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { LayoutGrid, Map as MapIcon, Radio, RefreshCw } from "lucide-react";
import { groupByEvent, eventEmoji, eventLabel } from "@/lib/live-events";
import { BroadcastCard } from "./BroadcastCard";
import { LiveMap } from "./LiveMap";
import { getDemoBroadcasts } from "@/lib/demo-live";
import type { LiveBroadcast } from "./types";

type ViewMode = "feed" | "map";

export function LiveFeed() {
  const [items, setItems] = useState<LiveBroadcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>("feed");
  const [event, setEvent] = useState<string>("all");
  const [team, setTeam] = useState<string>("all");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/broadcasts");
      if (res.ok) {
        const data = await res.json();
        setItems(data.broadcasts?.length ? data.broadcasts : getDemoBroadcasts());
      } else {
        setItems(getDemoBroadcasts());
      }
    } catch {
      setItems(getDemoBroadcasts());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    // Honor a ?event=<slug> deep link (e.g. from a live-event page).
    const q = new URLSearchParams(window.location.search).get("event");
    if (q) setEvent(q);
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
  const featuredGroups = useMemo(() => groupByEvent(filtered), [filtered]);

  return (
    <div className="mx-auto max-w-6xl px-4 pb-20 md:px-8">
      {/* Hero */}
      <section className="relative -mx-4 mb-8 overflow-hidden rounded-b-[2rem] md:-mx-8 md:mt-6 md:rounded-[2rem]">
        <div className="absolute inset-0 bg-gradient-to-br from-rose-50 via-orange-50 to-amber-50" />
        <div className="absolute -left-20 -top-20 h-64 w-64 rounded-full bg-rose-300/40 blur-3xl" />
        <div className="absolute right-[-5rem] top-6 h-72 w-72 rounded-full bg-orange-300/40 blur-3xl" />
        <div className="relative px-6 py-12 md:py-16">
          <div className="mx-auto max-w-2xl text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-600 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
              <Radio className="h-3.5 w-3.5" /> Happening now
            </span>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-stone-900 md:text-5xl">
              What&apos;s on right now
            </h1>
            <p className="mx-auto mt-3 max-w-lg text-base text-stone-600">
              Find where the game is showing — the vibe, the crowd, the big screen. Live from local
              venues near you.
            </p>
          </div>
        </div>
      </section>

      {/* Controls */}
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
          <Chip active={event === "all"} onClick={() => { setEvent("all"); setTeam("all"); }}>
            All ({items.length})
          </Chip>
          {groups.map((g) => (
            <Chip key={g.slug} active={event === g.slug} onClick={() => { setEvent(g.slug); setTeam("all"); }}>
              {eventEmoji(g.slug)} {eventLabel(g.slug, g.items[0]?.event_label)} ({g.items.length})
            </Chip>
          ))}
        </div>
        <div className="hidden shrink-0 items-center gap-2 sm:flex">
          <button
            onClick={load}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-stone-500 hover:bg-stone-100 hover:text-stone-900"
            aria-label="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <div className="flex rounded-full border border-stone-200 bg-white p-1">
            <ToggleBtn active={view === "feed"} onClick={() => setView("feed")}>
              <LayoutGrid className="h-4 w-4" /> Feed
            </ToggleBtn>
            <ToggleBtn active={view === "map"} onClick={() => setView("map")}>
              <MapIcon className="h-4 w-4" /> Map
            </ToggleBtn>
          </div>
        </div>
      </div>

      {/* Team-allegiance filter — "find the bar rooting for your team" */}
      {teamOptions.length > 0 && (
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-44 animate-pulse rounded-2xl bg-stone-100" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white/60 p-12 text-center">
          <p className="text-base font-medium text-stone-800">Nothing live right now.</p>
          <p className="mt-1 text-sm text-stone-500">
            Check back around game time — venues broadcast what they&apos;re showing here.
          </p>
        </div>
      ) : view === "map" ? (
        <LiveMap broadcasts={filtered} />
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white/60 p-12 text-center">
          <p className="text-base font-medium text-stone-800">No venues match that filter.</p>
          <p className="mt-1 text-sm text-stone-500">Try a different team or event.</p>
        </div>
      ) : event !== "all" ? (
        <Grid items={filtered} />
      ) : (
        // "All" view → featured lists grouped by event.
        <div className="space-y-10">
          {featuredGroups.map((g) => (
            <section key={g.slug}>
              <div className="mb-3 flex items-center gap-2">
                <h2 className="text-lg font-semibold text-stone-900">
                  {eventEmoji(g.slug)} {eventLabel(g.slug, g.items[0]?.event_label)}
                </h2>
                <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-500">
                  {g.items.length} {g.items.length === 1 ? "venue" : "venues"}
                </span>
              </div>
              <Grid items={g.items} />
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function Grid({ items }: { items: LiveBroadcast[] }) {
  return (
    <div className="grid auto-rows-fr grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((b) => (
        <BroadcastCard key={b.id} b={b} />
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
