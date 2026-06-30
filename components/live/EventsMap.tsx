"use client";

import dynamic from "next/dynamic";
import type { FeedEvent } from "@/app/api/events/feed/route";

export type MapEvent = FeedEvent & { live: boolean };

const EventsMapInner = dynamic(() => import("./EventsMapInner"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[520px] items-center justify-center rounded-2xl border border-stone-200 bg-stone-50 text-sm text-stone-400">
      Loading map…
    </div>
  ),
});

export function EventsMap({ events }: { events: MapEvent[] }) {
  return <EventsMapInner events={events} />;
}
