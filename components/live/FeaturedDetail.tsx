"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, LayoutGrid, Map as MapIcon, Radio } from "lucide-react";
import { eventEmoji } from "@/lib/live-events";
import { BroadcastCard } from "./BroadcastCard";
import { LiveMap } from "./LiveMap";
import { VenueCard, type FeaturedVenue } from "./VenueCard";
import { getDemoFeaturedLists } from "@/lib/demo-live";
import type { LiveBroadcast } from "./types";

interface FeaturedList {
  id: string;
  title: string;
  subtitle: string | null;
  event_slug: string | null;
  supports_team: string | null;
  broadcasts: LiveBroadcast[];
  venues: FeaturedVenue[];
}

type ViewMode = "feed" | "map";

export function FeaturedDetail({ id }: { id: string }) {
  const [list, setList] = useState<FeaturedList | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>("feed");

  useEffect(() => {
    let cancelled = false;
    function pick(lists: FeaturedList[]): FeaturedList | null {
      const pool = lists.length ? lists : (getDemoFeaturedLists() as FeaturedList[]);
      return pool.find((l) => l.id === id) ?? getDemoFeaturedLists().find((l) => l.id === id) ?? null;
    }
    fetch("/api/featured")
      .then((r) => (r.ok ? r.json() : { lists: [] }))
      .then((d) => {
        if (cancelled) return;
        setList(pick(d.lists ?? []));
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setList(pick([]));
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const broadcasts = useMemo(() => list?.broadcasts ?? [], [list]);

  return (
    <div className="mx-auto max-w-6xl px-4 pb-20 md:px-8">
      <div className="pt-6">
        <Link href="/" className="inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-900">
          <ArrowLeft className="h-4 w-4" /> Home
        </Link>
      </div>

      {loading ? (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-44 animate-pulse rounded-2xl bg-stone-100" />
          ))}
        </div>
      ) : !list ? (
        <div className="mt-10 rounded-2xl border border-dashed border-stone-300 bg-white/60 p-12 text-center">
          <p className="text-base font-medium text-stone-800">This list isn&apos;t available.</p>
          <Link href="/live" className="mt-2 inline-block text-sm font-medium text-rose-600 hover:text-rose-800">
            Browse what&apos;s live →
          </Link>
        </div>
      ) : (
        <>
          {/* Hero */}
          <section className="relative -mx-4 mt-4 mb-6 overflow-hidden rounded-[2rem] md:-mx-8">
            <div className="absolute inset-0 bg-gradient-to-br from-rose-50 via-orange-50 to-amber-50" />
            <div className="absolute -left-20 -top-20 h-64 w-64 rounded-full bg-rose-300/40 blur-3xl" />
            <div className="relative px-6 py-10 md:py-12">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-600 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
                <Radio className="h-3.5 w-3.5" /> Happening now
              </span>
              <h1 className="mt-3 flex items-center gap-2 text-3xl font-semibold tracking-tight text-stone-900 md:text-4xl">
                <span>{eventEmoji(list.event_slug)}</span> {list.title}
                {list.supports_team && (
                  <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-sm font-medium text-emerald-700">
                    🏳️ {list.supports_team}
                  </span>
                )}
              </h1>
              {list.subtitle && <p className="mt-2 max-w-xl text-base text-stone-600">{list.subtitle}</p>}
            </div>
          </section>

          {/* View toggle */}
          <div className="mb-5 flex items-center justify-between">
            <p className="text-sm text-stone-500">
              {broadcasts.length} live · {list.venues.length} more
            </p>
            <div className="flex rounded-full border border-stone-200 bg-white p-1">
              <Toggle active={view === "feed"} onClick={() => setView("feed")}>
                <LayoutGrid className="h-4 w-4" /> Feed
              </Toggle>
              <Toggle active={view === "map"} onClick={() => setView("map")}>
                <MapIcon className="h-4 w-4" /> Map
              </Toggle>
            </div>
          </div>

          {view === "map" ? (
            <LiveMap broadcasts={broadcasts} />
          ) : broadcasts.length === 0 && list.venues.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-stone-300 bg-white/60 p-12 text-center">
              <p className="text-base font-medium text-stone-800">Nothing live for this right now.</p>
              <p className="mt-1 text-sm text-stone-500">Check back around game time.</p>
            </div>
          ) : (
            <div className="grid auto-rows-fr grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {broadcasts.map((b) => (
                <BroadcastCard key={b.id} b={b} />
              ))}
              {list.venues.map((v) => (
                <VenueCard key={v.member_id} v={v} eventSlug={list.event_slug} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Toggle({
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
