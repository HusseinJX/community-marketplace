"use client";

import { MapContainer, TileLayer, Popup, Marker } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import Link from "next/link";
import { MapPin } from "lucide-react";
import { eventEmoji, eventLabel, timeLeftLabel } from "@/lib/live-events";
import type { FeedEvent } from "@/app/api/events/feed/route";
import type { LiveBroadcast } from "@/components/live/types";

// ONE map for "What's on" — live venues AND events on the same canvas.
//
// There used to be two maps (LiveMap + EventsMap), one per stacked feed, each
// behind its own Feed/Map toggle. Two MapContainers can't share a canvas, so
// merging the feeds meant merging the maps: red pulsing pins are venues live
// right now, calendar pins are events.

// Approximate centroids so events with only a city/neighborhood still place
// (vendor_events carry no lat/lng). Mirrors EventsMapInner.
const PLACES: Record<string, [number, number]> = {
  mission: [37.7599, -122.4148],
  soma: [37.7785, -122.4056],
  bayview: [37.7299, -122.3886],
  "san francisco": [37.7749, -122.4194],
  oakland: [37.8044, -122.2712],
  temescal: [37.8349, -122.263],
  berkeley: [37.8715, -122.273],
};

function jitter(id: string): [number, number] {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  const a = ((h % 1000) / 1000 - 0.5) * 0.02;
  const b = (((h >> 5) % 1000) / 1000 - 0.5) * 0.02;
  return [a, b];
}

function geoEvent(e: FeedEvent): [number, number] | null {
  const key = (e.neighborhood || e.city || "").trim().toLowerCase();
  const base = PLACES[key] ?? (e.city ? PLACES[e.city.trim().toLowerCase()] : undefined);
  if (!base) return null;
  const [ja, jb] = jitter(e.eventId);
  return [base[0] + ja, base[1] + jb];
}

function liveIcon(emoji: string): L.DivIcon {
  const html = `
    <div style="position:relative;width:40px;height:40px;">
      <div style="position:absolute;inset:0;border-radius:9999px;background:#f43f5e;opacity:0.25;animation:wo-ping 1.6s ease-out infinite;"></div>
      <div style="position:absolute;top:4px;left:4px;width:32px;height:32px;border-radius:9999px;background:white;border:2.5px solid #f43f5e;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 1px 5px rgba(0,0,0,0.3);">${emoji}</div>
    </div>`;
  return L.divIcon({ html, className: "", iconSize: [40, 40], iconAnchor: [20, 20], popupAnchor: [0, -18] });
}

function eventIcon(): L.DivIcon {
  const html = `
    <div style="position:relative;width:34px;height:34px;">
      <div style="position:absolute;top:3px;left:3px;width:28px;height:28px;border-radius:9999px;background:white;border:2.5px solid #0ea5e9;display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 1px 5px rgba(0,0,0,0.3);">📅</div>
    </div>`;
  return L.divIcon({ html, className: "", iconSize: [34, 34], iconAnchor: [17, 17], popupAnchor: [0, -16] });
}

export default function WhatsOnMapInner({
  broadcasts,
  events,
}: {
  broadcasts: LiveBroadcast[];
  events: FeedEvent[];
}) {
  const venues = broadcasts.filter(
    (b) => typeof b.latitude === "number" && typeof b.longitude === "number",
  );
  const placed = events
    .map((e) => ({ e, pos: geoEvent(e) }))
    .filter((x): x is { e: FeedEvent; pos: [number, number] } => x.pos !== null);

  const center: [number, number] =
    venues.length > 0
      ? [venues[0].latitude as number, venues[0].longitude as number]
      : placed.length > 0
        ? placed[0].pos
        : [37.7749, -122.4194];

  if (venues.length === 0 && placed.length === 0) {
    return (
      <div className="flex h-[520px] flex-col items-center justify-center rounded-2xl border border-dashed border-stone-300 bg-white/60 text-center">
        <MapPin className="mb-2 h-6 w-6 text-stone-300" />
        <p className="text-sm font-medium text-stone-700">Nothing to map right now.</p>
        <p className="mt-1 text-xs text-stone-500">These spots don&apos;t have a known location yet.</p>
      </div>
    );
  }

  return (
    <>
      <style>{`@keyframes wo-ping{0%{transform:scale(1);opacity:.25}70%{transform:scale(2.2);opacity:0}100%{transform:scale(2.2);opacity:0}}`}</style>
      <MapContainer center={center} zoom={12} style={{ height: "520px", width: "100%", borderRadius: "1rem" }} className="z-0">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Live venues — pulsing */}
        {venues.map((b) => (
          <Marker
            key={`b-${b.id}`}
            position={[b.latitude as number, b.longitude as number]}
            icon={liveIcon(eventEmoji(b.event_slug))}
          >
            <Popup>
              <div className="min-w-[160px]">
                <p className="text-sm font-semibold text-stone-900">{b.member_name}</p>
                <p className="mt-0.5 text-xs text-stone-500">
                  {b.whats_on || eventLabel(b.event_slug)}
                </p>
                {b.ends_at && (
                  <span className="mt-1 inline-block rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-medium text-rose-700">
                    {timeLeftLabel(b.ends_at)}
                  </span>
                )}
                <Link href={`/live/${b.id}`} className="mt-1 block text-xs font-medium text-rose-600 hover:underline">
                  See it →
                </Link>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Events */}
        {placed.map(({ e, pos }) => (
          <Marker key={`e-${e.eventId}`} position={pos} icon={eventIcon()}>
            <Popup>
              <div className="min-w-[160px]">
                <p className="text-sm font-semibold text-stone-900">{e.title}</p>
                {e.date && <p className="mt-0.5 text-xs text-stone-500">{e.date}</p>}
                {e.collaborators > 1 && (
                  <span className="mt-1 inline-block rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-medium text-stone-600">
                    {e.collaborators} teamed up
                  </span>
                )}
                <Link href={`/events/${e.eventId}`} className="mt-1 block text-xs font-medium text-sky-600 hover:underline">
                  View event →
                </Link>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </>
  );
}
