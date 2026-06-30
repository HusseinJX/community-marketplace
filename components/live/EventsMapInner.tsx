"use client";

import { MapContainer, TileLayer, Popup, Marker } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import Link from "next/link";
import { MapPin } from "lucide-react";
import type { MapEvent } from "./EventsMap";

// Approximate centroids so events with only a city/neighborhood still place on
// the map (vendor_events carry no lat/lng). Add entries as new places appear.
const PLACES: Record<string, [number, number]> = {
  mission: [37.7599, -122.4148],
  soma: [37.7785, -122.4056],
  bayview: [37.7299, -122.3886],
  "san francisco": [37.7749, -122.4194],
  oakland: [37.8044, -122.2712],
  temescal: [37.8349, -122.263],
  berkeley: [37.8715, -122.273],
};

// Deterministic small jitter from the event id so co-located pins don't stack.
function jitter(id: string): [number, number] {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  const a = ((h % 1000) / 1000 - 0.5) * 0.02;
  const b = (((h >> 5) % 1000) / 1000 - 0.5) * 0.02;
  return [a, b];
}

function geo(e: MapEvent): [number, number] | null {
  const key = (e.neighborhood || e.city || "").trim().toLowerCase();
  const base = PLACES[key] ?? (e.city ? PLACES[e.city.trim().toLowerCase()] : undefined);
  if (!base) return null;
  const [ja, jb] = jitter(e.eventId);
  return [base[0] + ja, base[1] + jb];
}

function eventIcon(live: boolean): L.DivIcon {
  const color = live ? "#10b981" : "#0ea5e9";
  const html = `
    <div style="position:relative;width:34px;height:34px;">
      ${live ? `<div style="position:absolute;inset:0;border-radius:9999px;background:${color};opacity:0.25;animation:ev-ping 1.6s ease-out infinite;"></div>` : ""}
      <div style="position:absolute;top:3px;left:3px;width:28px;height:28px;border-radius:9999px;background:white;border:2.5px solid ${color};display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 1px 5px rgba(0,0,0,0.3);">📅</div>
    </div>`;
  return L.divIcon({ html, className: "", iconSize: [34, 34], iconAnchor: [17, 17], popupAnchor: [0, -16] });
}

export default function EventsMapInner({ events }: { events: MapEvent[] }) {
  const placed = events
    .map((e) => ({ e, pos: geo(e) }))
    .filter((x): x is { e: MapEvent; pos: [number, number] } => x.pos !== null);

  const center: [number, number] = placed.length > 0 ? placed[0].pos : [37.7749, -122.4194];

  if (placed.length === 0) {
    return (
      <div className="flex h-[520px] flex-col items-center justify-center rounded-2xl border border-dashed border-stone-300 bg-white/60 text-center">
        <MapPin className="mb-2 h-6 w-6 text-stone-300" />
        <p className="text-sm font-medium text-stone-700">No mappable events.</p>
        <p className="mt-1 text-xs text-stone-500">These events don&apos;t have a known location yet.</p>
      </div>
    );
  }

  return (
    <>
      <style>{`@keyframes ev-ping{0%{transform:scale(1);opacity:.25}70%{transform:scale(2.2);opacity:0}100%{transform:scale(2.2);opacity:0}}`}</style>
      <MapContainer
        center={center}
        zoom={12}
        style={{ height: "520px", width: "100%", borderRadius: "1rem" }}
        className="z-0"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {placed.map(({ e, pos }) => (
          <Marker key={e.eventId} position={pos} icon={eventIcon(e.live)}>
            <Popup>
              <div className="min-w-[160px]">
                <p className="text-sm font-semibold text-stone-900">{e.title}</p>
                {e.date && <p className="mt-0.5 text-xs text-stone-500">{e.date}</p>}
                {(e.location || e.city) && (
                  <p className="text-xs text-stone-500">{[e.location, e.city].filter(Boolean).join(" · ")}</p>
                )}
                <span
                  className={
                    "mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium " +
                    (e.live ? "bg-emerald-100 text-emerald-700" : "bg-sky-100 text-sky-700")
                  }
                >
                  {e.live ? "Happening today" : "Upcoming"}
                </span>
                <Link href={`/events/${e.eventId}`} className="mt-1 block text-xs font-medium text-rose-600 hover:underline">
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
