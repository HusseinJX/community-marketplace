"use client";

import { useMemo } from "react";
import { useEventsFeed } from "@/lib/data-hooks";
import { EventsMap, type MapEvent } from "@/components/live/EventsMap";

// The Events tab's third view: the same events, as pins.
//
// Reads the SAME SWR key as the other two views (useEventsFeed), so switching
// to the map costs no request and shows exactly what the list showed — a map
// that quietly disagreed with the list above it would be worse than no map.
//
// Every pin is calm. `live` (the pulsing pin) would mean reading the clock,
// and doing that during render is both impure and a hydration mismatch waiting
// to happen — the server and the browser can disagree about what day it is.
// The date is in the popup, which is where someone looking at a map asks for
// it. If the pulse is wanted later, take the timestamp the same way
// CommunityEventsLive does (an effect), not inline.
export function EventsMapView() {
  const { events, loading } = useEventsFeed();

  const mapEvents: MapEvent[] = useMemo(
    () => events.map((e) => ({ ...e, live: false })),
    [events],
  );

  if (loading) {
    return (
      <div className="flex h-[520px] items-center justify-center rounded-2xl border border-stone-200 bg-stone-50 text-sm text-stone-400">
        Loading map…
      </div>
    );
  }

  return <EventsMap events={mapEvents} />;
}
