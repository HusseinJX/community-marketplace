"use client";

import Link from "next/link";
import { MapPin } from "lucide-react";
import { eventEmoji, eventLabel } from "@/lib/live-events";

export interface FeaturedVenue {
  member_id: string;
  name: string;
  neighborhood: string | null;
  city: string | null;
}

// A pinned venue that isn't broadcasting right now — "shows it here" evergreen card.
export function VenueCard({ v, eventSlug }: { v: FeaturedVenue; eventSlug: string | null }) {
  const place = [v.neighborhood, v.city].filter(Boolean).join(", ");
  return (
    <Link href={`/members/${v.member_id}`} className="card-soft card-hover flex h-full flex-col gap-2 p-4">
      <div className="flex items-center gap-2">
        <span className="text-2xl">{eventEmoji(eventSlug)}</span>
        <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-stone-500">
          Shows {eventLabel(eventSlug)}
        </span>
      </div>
      <p className="text-base font-semibold text-stone-900">{v.name}</p>
      {place && (
        <p className="mt-auto inline-flex items-center gap-1 text-xs text-stone-500">
          <MapPin className="h-3.5 w-3.5" /> {place}
        </p>
      )}
    </Link>
  );
}
