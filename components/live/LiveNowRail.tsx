"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { eventEmoji, eventLabel, timeLeftLabel } from "@/lib/live-events";
import { distanceKm } from "@/lib/native-geo";
import { useHomePosition } from "@/lib/home-position";
import { useBroadcasts } from "@/lib/data-hooks";
import { matchKeyOf } from "@/lib/demo-live-fixtures";
import type { LiveBroadcast } from "./types";

// Compact "Live now near you" strip — the top of the home EVENTS tab.
//
// A broadcast is an event: it is a thing happening at a place, at a time, that
// you could go to. It just happens to have started already. Keeping it on its
// own tab meant "what's on tonight" and "what's on RIGHT NOW" lived on two
// different screens, and the one people actually want first was the one behind
// the extra tap. So the full feed still has its tab, and its most urgent slice
// sits above the dated list where the question is being asked.
//
// Renders nothing when nothing is live, so it costs no space on a quiet day —
// which is what lets it sit above the fold without apology.
export function LiveNowRail() {
  // Shared cache with the main live feed — one request, instant on return.
  const { broadcasts: items } = useBroadcasts();
  // The shared home position — the same lookup the city header, the directory
  // and the events feed read. Asking the device directly here was a second
  // permission dialog on the same screen.
  const { position } = useHomePosition();

  // Nearest-first when we know where the viewer is; venues without coordinates
  // fall to the back. Otherwise keep the feed's (recency) order.
  const ranked = useMemo(() => {
    if (!position) return items;
    const dist = (b: LiveBroadcast) =>
      typeof b.latitude === "number" && typeof b.longitude === "number"
        ? distanceKm(position.lat, position.lng, b.latitude, b.longitude)
        : Number.POSITIVE_INFINITY;
    return [...items].sort((a, b) => dist(a) - dist(b));
  }, [items, position]);

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
        {/* The feed tab, not "/" — home defaults to Products now, so /live's
            redirect to the index would land somewhere with no broadcasts. */}
        <Link
          href="/?tab=feed"
          className="inline-flex items-center gap-1 text-xs font-medium text-rose-600 hover:text-rose-800"
        >
          See all <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
        {ranked.slice(0, 12).map((b) => (
          <Link
            key={b.id}
            // The MATCH, not this one venue. The card is titled with the
            // fixture, so the question it raises is "who's showing it?" — and
            // the answer is a list of every place, with a map. Landing on one
            // bar's page instead makes you go back and try the next card to
            // find out who else has it on.
            href={`/live/match/${encodeURIComponent(matchKeyOf(b))}`}
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
