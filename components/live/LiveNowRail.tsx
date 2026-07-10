"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { eventEmoji, eventLabel, timeLeftLabel } from "@/lib/live-events";
import { getUserPosition, distanceKm } from "@/lib/native-geo";
import type { LiveBroadcast } from "./types";

// Compact "Live Now near you" strip for the home page. Renders nothing when
// there's nothing live, so it never takes up space on a quiet day.
export function LiveNowRail() {
  const [items, setItems] = useState<LiveBroadcast[]>([]);
  const [coords, setCoords] = useState<[number, number] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/broadcasts")
      .then((r) => (r.ok ? r.json() : { broadcasts: [] }))
      .then((d) => {
        if (!cancelled && d.broadcasts?.length) setItems(d.broadcasts);
      })
      .catch(() => {
        /* keep demo content already shown */
      });
    // Best-effort location so "near you" is literally true (silent if denied).
    getUserPosition().then((c) => !cancelled && setCoords(c)).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Nearest-first when we know where the viewer is; venues without coordinates
  // fall to the back. Otherwise keep the feed's (recency) order.
  const ranked = useMemo(() => {
    if (!coords) return items;
    const [uLat, uLng] = coords;
    const dist = (b: LiveBroadcast) =>
      typeof b.latitude === "number" && typeof b.longitude === "number"
        ? distanceKm(uLat, uLng, b.latitude, b.longitude)
        : Number.POSITIVE_INFINITY;
    return [...items].sort((a, b) => dist(a) - dist(b));
  }, [items, coords]);

  if (items.length === 0) return null;

  return (
    <section className="mb-6 overflow-hidden rounded-2xl border border-rose-100 bg-gradient-to-br from-rose-50 to-orange-50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-rose-700">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-500 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-600" />
          </span>
          Live now near you
        </h2>
        <Link
          href="/live"
          className="inline-flex items-center gap-1 text-xs font-medium text-rose-600 hover:text-rose-800"
        >
          See all <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
        {ranked.slice(0, 12).map((b) => (
          <Link
            key={b.id}
            href={`/live/${b.id}`}
            className="group flex w-56 shrink-0 flex-col gap-1 rounded-xl bg-white/80 p-3 ring-1 ring-rose-100 transition hover:ring-rose-300"
          >
            <div className="flex items-center gap-2">
              <span className="text-xl">{eventEmoji(b.event_slug)}</span>
              <span className="truncate text-xs font-medium text-stone-500">
                {eventLabel(b.event_slug, b.event_label)}
              </span>
            </div>
            <p className="truncate text-sm font-semibold text-stone-900">
              {b.whats_on || eventLabel(b.event_slug, b.event_label)}
            </p>
            <p className="truncate text-xs text-stone-500">{b.member_name}</p>
            <p className="text-xs font-medium text-rose-600">{timeLeftLabel(b.ends_at)}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
