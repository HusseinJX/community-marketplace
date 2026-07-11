"use client";

import dynamic from "next/dynamic";

const EventLocationMapInner = dynamic(() => import("./EventLocationMapInner"), {
  ssr: false,
  loading: () => (
    <div className="flex h-40 items-center justify-center rounded-xl border border-stone-200 bg-stone-50 text-xs text-stone-400">
      Loading map…
    </div>
  ),
});

// Read-only single-pin map for the event page. `lat`/`lng` are the event's own
// coordinates (defaulted to the host business at create time).
export function EventLocationMap({
  lat,
  lng,
  label,
}: {
  lat: number;
  lng: number;
  label?: string;
}) {
  return <EventLocationMapInner lat={lat} lng={lng} label={label} />;
}
