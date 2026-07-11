"use client";

import dynamic from "next/dynamic";

const EventLocationPickerInner = dynamic(() => import("./EventLocationPickerInner"), {
  ssr: false,
  loading: () => (
    <div className="flex h-44 items-center justify-center rounded-xl border border-stone-200 bg-stone-50 text-xs text-stone-400">
      Loading map…
    </div>
  ),
});

// Draggable-pin map for the create-event form. `value` is the current pin (null
// until the business location is known); `onChange` fires with the new [lat,lng]
// as the organizer drags or clicks the map.
export function EventLocationPicker({
  value,
  onChange,
}: {
  value: [number, number] | null;
  onChange: (pos: [number, number]) => void;
}) {
  return <EventLocationPickerInner value={value} onChange={onChange} />;
}
