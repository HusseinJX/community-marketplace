"use client";

import { useState } from "react";
import { MapContainer, Popup, Marker } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { BaseTiles } from "@/components/map/BaseTiles";
import Link from "next/link";
import { eventEmoji, eventLabel, timeLeftLabel } from "@/lib/live-events";
import type { LiveBroadcast } from "./types";

// A pulsing red "live" pin with the event emoji in the middle.
function liveIcon(emoji: string): L.DivIcon {
  const html = `
    <div style="position:relative;width:40px;height:40px;">
      <div style="
        position:absolute;inset:0;border-radius:9999px;background:#f43f5e;opacity:0.25;
        animation:live-ping 1.6s ease-out infinite;
      "></div>
      <div style="
        position:absolute;top:4px;left:4px;width:32px;height:32px;border-radius:9999px;
        background:white;border:2.5px solid #f43f5e;display:flex;align-items:center;
        justify-content:center;font-size:16px;box-shadow:0 1px 5px rgba(0,0,0,0.3);
      ">${emoji}</div>
    </div>`;
  return L.divIcon({ html, className: "", iconSize: [40, 40], iconAnchor: [20, 20], popupAnchor: [0, -18] });
}

export default function LiveMapInner({ broadcasts }: { broadcasts: LiveBroadcast[] }) {
  const pinned = broadcasts.filter(
    (b) => typeof b.latitude === "number" && typeof b.longitude === "number"
  );

  const [center] = useState<[number, number]>(() =>
    pinned.length > 0
      ? [pinned[0].latitude as number, pinned[0].longitude as number]
      : [37.7749, -122.4194]
  );

  return (
    <>
      <style>{`
        @keyframes live-ping {
          0%   { transform: scale(1);   opacity: 0.25; }
          70%  { transform: scale(2.2); opacity: 0; }
          100% { transform: scale(2.2); opacity: 0; }
        }
      `}</style>
      <div className="relative">
        <MapContainer
          center={center}
          zoom={12}
          style={{ height: "520px", width: "100%", borderRadius: "1rem" }}
          className="z-0"
        >
          <BaseTiles />

          {pinned.map((b) => (
            <Marker
              key={b.id}
              position={[b.latitude as number, b.longitude as number]}
              icon={liveIcon(eventEmoji(b.event_slug))}
            >
              <Popup>
                <div className="text-sm">
                  <p className="font-semibold">{b.whats_on || eventLabel(b.event_slug, b.event_label)}</p>
                  <p className="text-xs text-stone-500">
                    {b.member_name} · {eventLabel(b.event_slug, b.event_label)}
                  </p>
                  <p className="text-xs font-medium text-rose-600">{timeLeftLabel(b.ends_at)}</p>
                  <Link
                    href={`/members/${b.member_id}`}
                    className="mt-1 inline-block text-xs text-indigo-600 hover:underline"
                  >
                    View venue →
                  </Link>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        {pinned.length === 0 && (
          <div className="absolute inset-0 z-[500] flex items-center justify-center rounded-2xl bg-white/60 backdrop-blur-sm">
            <p className="text-sm text-stone-500">No live venues have shared a location yet.</p>
          </div>
        )}
      </div>
    </>
  );
}
