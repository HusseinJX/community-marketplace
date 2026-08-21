"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { MapPin, ChevronRight, ArrowLeft, Map as MapIcon, List, Radio } from "lucide-react";
import { eventEmoji, eventLabel, timeLeftLabel } from "@/lib/live-events";
import { fetchLiveBroadcasts, matchKeyOf } from "@/lib/demo-live-fixtures";
import { useHomePosition } from "@/lib/home-position";
import { distanceKm } from "@/lib/native-geo";
import { LiveMap } from "./LiveMap";
import type { LiveBroadcast } from "./types";

// "Where to watch this game" — one match, every place showing it.
//
// This is the answer to the only question a live card raises. You saw "Lakers
// vs Warriors" on the feed; you want to know who has it on and which is
// nearest. So the page is a LIST RANKED BY DISTANCE with a map beside it, and
// nothing else competes for the top of the screen.
//
// ── Layout ────────────────────────────────────────────────────────────────
// Desktop: listings left, map sticky right — the split every "find a place"
// product uses, because the map is context for the list rather than something
// you read on its own.
//
// Phone: a LIST/MAP TOGGLE, not a stacked map. Stacked, a 260px map sat above
// the listings, so the answer to "who's showing it" started below the fold and
// you scrolled past a map you hadn't asked for to reach it. One at a time, list
// first.

function useRankedVenues(key: string) {
  const [all, setAll] = useState<LiveBroadcast[] | null>(null);
  const { position } = useHomePosition();

  useEffect(() => {
    let cancelled = false;
    void fetchLiveBroadcasts().then((bcs) => {
      if (!cancelled) setAll(bcs);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const venues = useMemo(() => (all ?? []).filter((b) => matchKeyOf(b) === key), [all, key]);

  // Nearest first, with each distance measured ONCE rather than inside a
  // comparator. Venues we can't place fall to the back.
  const ranked = useMemo(() => {
    const measured = venues.map((v) => ({
      v,
      km:
        position && typeof v.latitude === "number" && typeof v.longitude === "number"
          ? distanceKm(position.lat, position.lng, v.latitude, v.longitude)
          : null,
    }));
    if (!position) return measured;
    return [...measured].sort((a, b) => (a.km ?? Infinity) - (b.km ?? Infinity));
  }, [venues, position]);

  return { ranked, loading: all === null };
}

export function MatchDetail({ matchKey }: { matchKey: string }) {
  const key = decodeURIComponent(matchKey);
  const { ranked, loading } = useRankedVenues(key);
  const [view, setView] = useState<"list" | "map">("list");

  const first = ranked[0]?.v;
  const mapped = useMemo(
    () => ranked.map((r) => r.v).filter((v) => v.latitude != null && v.longitude != null),
    [ranked],
  );

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 pt-6 md:px-8">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-stone-100" />
        <div className="mt-6 space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-stone-100" />
          ))}
        </div>
      </div>
    );
  }

  if (!first) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16 md:px-8">
        <BackLink />
        <div className="mt-6 rounded-2xl border border-dashed border-stone-300 bg-white/60 p-12 text-center">
          <p className="text-base font-medium text-stone-800">Nobody&apos;s showing this right now.</p>
          <Link
            href="/?tab=events"
            className="mt-2 inline-block text-sm font-medium text-coral-600 hover:text-coral-700"
          >
            See what&apos;s on →
          </Link>
        </div>
      </div>
    );
  }

  const title = first.whats_on || eventLabel(first.event_slug, first.event_label);
  const count = ranked.length;

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-4 md:px-8">
      <BackLink />

      {/* The title band. The matchup IS the page, so it takes page-title size
          and the league sits above it as a quiet chip rather than competing. */}
      <header className="mt-3">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-stone-100 px-2.5 py-1 text-[12px] font-semibold text-stone-600">
          <span aria-hidden>{eventEmoji(first.event_slug)}</span>
          {eventLabel(first.event_slug, first.event_label)}
        </span>
        <h1 className="mt-2 text-[26px] font-bold leading-tight tracking-tight text-stone-900 sm:text-3xl">
          {title}
        </h1>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px] text-stone-500">
          <span className="font-medium text-stone-900">
            {count} {count === 1 ? "place" : "places"} showing it
          </span>
          <span className="inline-flex items-center gap-1.5 font-medium text-rose-600">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-500 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-600" />
            </span>
            {timeLeftLabel(first.ends_at)}
          </span>
        </div>
      </header>

      {/* Phone only: which half you're looking at. Desktop shows both. */}
      {mapped.length > 0 && (
        <div className="mt-4 inline-flex rounded-full bg-stone-100 p-1 md:hidden">
          {(
            [
              { id: "list", Icon: List, label: "List" },
              { id: "map", Icon: MapIcon, label: "Map" },
            ] as const
          ).map(({ id, Icon, label }) => (
            <button
              key={id}
              onClick={() => setView(id)}
              aria-pressed={view === id}
              className={
                "inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[13px] font-medium transition " +
                (view === id ? "bg-white text-stone-900 shadow-sm" : "text-stone-500")
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      )}

      <div className="mt-4 grid gap-5 md:grid-cols-[1fr_40%]">
        {/* Map — sticky beside the list on desktop; a full panel on a phone, and
            only when asked for. */}
        {mapped.length > 0 && (
          <div className={`md:order-2 ${view === "map" ? "block" : "hidden md:block"}`}>
            <div className="overflow-hidden rounded-2xl border border-stone-200 md:sticky md:top-24">
              <LiveMap broadcasts={mapped} />
            </div>
          </div>
        )}

        <div className={`space-y-3 md:order-1 ${view === "list" ? "block" : "hidden md:block"}`}>
          {ranked.map(({ v, km }) => (
            <VenueListing key={v.id} v={v} km={km} />
          ))}
        </div>
      </div>
    </div>
  );
}

function BackLink() {
  return (
    // Names where it goes. "Back" alone, on a page reached from a rail on a
    // tab, is a promise the browser might not keep.
    <Link
      href="/?tab=events"
      className="inline-flex items-center gap-1.5 text-[14px] font-medium text-stone-500 transition hover:text-stone-900"
    >
      <ArrowLeft className="h-4 w-4" /> What&apos;s on
    </Link>
  );
}

function VenueListing({ v, km }: { v: LiveBroadcast; km: number | null }) {
  const place = [v.neighborhood, v.city].filter(Boolean).join(", ");
  const cover = v.image_urls?.[0];
  const miles = km == null ? null : km * 0.621371;

  return (
    <Link
      href={`/live/${v.id}`}
      className="group flex items-stretch gap-3.5 overflow-hidden rounded-2xl border border-stone-200 bg-white p-3 transition hover:border-stone-900 hover:shadow-[var(--shadow-lift)]"
    >
      {cover ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={cover} alt="" className="h-24 w-24 shrink-0 rounded-xl object-cover sm:h-28 sm:w-28" />
      ) : (
        <span className="flex h-24 w-24 shrink-0 items-center justify-center rounded-xl bg-stone-100 text-4xl sm:h-28 sm:w-28">
          {eventEmoji(v.event_slug)}
        </span>
      )}

      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
        <p className="truncate text-[17px] font-semibold text-stone-900">{v.member_name || "Venue"}</p>

        {/* Where, and how far. Distance is what actually decides between two
            bars showing the same game, so it sits on the same line as the
            neighbourhood rather than in a chip further down. */}
        {(place || miles != null) && (
          <p className="inline-flex items-center gap-1.5 truncate text-[14px] text-stone-500">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{place}</span>
            {miles != null && (
              <span className="shrink-0 font-medium text-stone-700">· {miles.toFixed(1)} mi</span>
            )}
          </p>
        )}

        {v.note && <p className="truncate text-[13px] text-stone-500">{v.note}</p>}

        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[12px]">
          {v.supports_team && (
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700">
              Backing {v.supports_team}
            </span>
          )}
          <span className="inline-flex items-center gap-1 font-medium text-rose-600">
            <Radio className="h-3 w-3" />
            {timeLeftLabel(v.ends_at)}
          </span>
        </div>
      </div>

      <ChevronRight className="h-5 w-5 shrink-0 self-center text-stone-300 transition group-hover:text-stone-900" />
    </Link>
  );
}
