"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { eventEmoji } from "@/lib/live-events";
import { BroadcastCard } from "./BroadcastCard";
import { VenueCard, type FeaturedVenue } from "./VenueCard";
import { useFeatured } from "@/lib/data-hooks";
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

// Admin-curated home rails ("Where to watch the NBA Finals near you") rendered as
// horizontal scrollers, each openable to its own /featured/[id] page.
// Renders nothing when there are no non-empty lists.
export function FeaturedLists() {
  // Shared cache with FeaturedDetail (/featured/[id]) — one request, instant.
  const { lists } = useFeatured<FeaturedList>();

  if (lists.length === 0) return null;

  return (
    <div className="mb-8 space-y-8">
      {lists.map((l) => {
        const count = l.broadcasts.length + l.venues.length;
        return (
          <section key={l.id}>
            <div className="mb-3 flex items-end justify-between gap-3">
              <Link href={`/featured/${l.id}`} className="group min-w-0">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-stone-900">
                  <span>{eventEmoji(l.event_slug)}</span>
                  <span className="truncate group-hover:text-rose-700">{l.title}</span>
                  {l.supports_team && (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                      🏳️ {l.supports_team}
                    </span>
                  )}
                </h2>
                {l.subtitle && <p className="mt-0.5 truncate text-sm text-stone-500">{l.subtitle}</p>}
              </Link>
              <Link
                href={`/featured/${l.id}`}
                className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-rose-600 ring-1 ring-rose-100 transition hover:ring-rose-300"
              >
                See all{count ? ` (${count})` : ""} <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {/* Horizontal scroller */}
            <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 md:-mx-8 md:px-8 [scrollbar-width:thin]">
              {l.broadcasts.map((b) => (
                <div key={b.id} className="w-[19rem] shrink-0 snap-start">
                  <BroadcastCard b={b} />
                </div>
              ))}
              {l.venues.map((v) => (
                <div key={v.member_id} className="w-[19rem] shrink-0 snap-start">
                  <VenueCard v={v} eventSlug={l.event_slug} />
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
