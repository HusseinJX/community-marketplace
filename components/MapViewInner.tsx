"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import Link from "next/link";
import type { Member, MemberType } from "@/lib/types";

const TYPE_COLORS: Record<MemberType | "unknown", string> = {
  vendor:     "#3B82F6",
  artist:     "#8B5CF6",
  organizer:  "#10B981",
  shopper:    "#F97316",
  influencer: "#EC4899",
  unknown:    "#6B7280",
};

const LEGEND: { type: MemberType; label: string }[] = [
  { type: "vendor",     label: "Vendor" },
  { type: "artist",     label: "Artist" },
  { type: "organizer",  label: "Organizer" },
  { type: "shopper",    label: "Shopper" },
  { type: "influencer", label: "Influencer" },
];

function userLocationIcon() {
  return L.divIcon({
    html: `
      <div style="position:relative;width:24px;height:24px;">
        <div style="
          position:absolute;inset:0;border-radius:50%;
          background:#3B82F6;opacity:0.25;
          animation:user-ping 1.4s ease-out infinite;
        "></div>
        <div style="
          position:absolute;top:6px;left:6px;
          width:12px;height:12px;border-radius:50%;
          background:#3B82F6;border:2.5px solid white;
          box-shadow:0 1px 4px rgba(0,0,0,0.35);
        "></div>
      </div>`,
    className: "",
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

// Inner component — lives inside MapContainer so it can call useMap()
function LocationControl({
  userPos,
  onLocate,
  locating,
}: {
  userPos: [number, number] | null;
  onLocate: () => void;
  locating: boolean;
}) {
  const map = useMap();

  useEffect(() => {
    if (userPos) map.flyTo(userPos, Math.max(map.getZoom(), 13), { duration: 1.2 });
  }, [userPos, map]);

  return (
    <>
      {userPos && (
        <Marker position={userPos} icon={userLocationIcon()} />
      )}

      {/* Locate button — rendered as a Leaflet control overlay */}
      <div
        className="leaflet-top leaflet-right"
        style={{ pointerEvents: "auto" }}
      >
        <div className="leaflet-control leaflet-bar" style={{ border: "none", margin: "10px" }}>
          <button
            onClick={onLocate}
            disabled={locating}
            title="Center on my location"
            style={{
              width: 36, height: 36,
              background: "white",
              border: "2px solid rgba(0,0,0,0.2)",
              borderRadius: 4,
              cursor: locating ? "default" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 1px 5px rgba(0,0,0,0.15)",
            }}
          >
            {locating ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2">
                <circle cx="12" cy="12" r="10" strokeDasharray="31.4" strokeDashoffset="10">
                  <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.8s" repeatCount="indefinite"/>
                </circle>
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2">
                <circle cx="12" cy="12" r="3" fill="#3B82F6" stroke="none"/>
                <circle cx="12" cy="12" r="8" />
                <line x1="12" y1="2" x2="12" y2="5"/>
                <line x1="12" y1="19" x2="12" y2="22"/>
                <line x1="2" y1="12" x2="5" y2="12"/>
                <line x1="19" y1="12" x2="22" y2="12"/>
              </svg>
            )}
          </button>
        </div>
      </div>
    </>
  );
}

export default function MapViewInner({ members }: { members: Member[] }) {
  const [userPos, setUserPos] = useState<[number, number] | null>(null);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);

  const pinned = members.filter(
    (m) => typeof m.profile?.latitude === "number" && typeof m.profile?.longitude === "number"
  );

  const mapCenter: [number, number] =
    pinned.length > 0
      ? [pinned[0].profile!.latitude as number, pinned[0].profile!.longitude as number]
      : [20, 0];

  function handleLocate() {
    if (!navigator.geolocation) {
      setLocError("Geolocation not supported by your browser.");
      return;
    }
    setLocating(true);
    setLocError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserPos([pos.coords.latitude, pos.coords.longitude]);
        setLocating(false);
      },
      () => {
        setLocError("Could not get your location. Check browser permissions.");
        setLocating(false);
      },
      { timeout: 8000 }
    );
  }

  return (
    <>
      {/* Blinking dot keyframe */}
      <style>{`
        @keyframes user-ping {
          0%   { transform: scale(1);   opacity: 0.25; }
          70%  { transform: scale(2.5); opacity: 0; }
          100% { transform: scale(2.5); opacity: 0; }
        }
      `}</style>

      <div className="relative">
        <MapContainer
          center={mapCenter}
          zoom={pinned.length > 0 ? 11 : 2}
          style={{ height: "520px", width: "100%", borderRadius: "1rem" }}
          className="z-0"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {pinned.map((m) => {
            const type = (m.profile?.memberType ?? "unknown") as MemberType | "unknown";
            const color = TYPE_COLORS[type] ?? TYPE_COLORS.unknown;
            const name = (m.profile?.name as string) || "Member";
            const location = [m.profile?.neighborhood, m.profile?.city].filter(Boolean).join(", ");
            return (
              <CircleMarker
                key={m.id}
                center={[m.profile!.latitude as number, m.profile!.longitude as number]}
                radius={9}
                fillColor={color}
                color="white"
                weight={2}
                fillOpacity={0.9}
              >
                <Popup>
                  <div className="text-sm">
                    <p className="font-semibold">{name}</p>
                    {location && <p className="text-stone-500 text-xs">{location}</p>}
                    <Link
                      href={`/members/${m.id}`}
                      className="text-indigo-600 hover:underline text-xs mt-1 inline-block"
                    >
                      View profile →
                    </Link>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}

          <LocationControl
            userPos={userPos}
            onLocate={handleLocate}
            locating={locating}
          />
        </MapContainer>

        {/* Legend */}
        <div className="absolute bottom-4 left-4 z-[1000] flex flex-wrap gap-2 rounded-xl border border-stone-200 bg-white/90 px-3 py-2 shadow backdrop-blur-sm">
          {LEGEND.map(({ type, label }) => (
            <div key={type} className="flex items-center gap-1.5">
              <span
                className="inline-block h-3 w-3 rounded-full"
                style={{ backgroundColor: TYPE_COLORS[type] }}
              />
              <span className="text-xs text-stone-700">{label}</span>
            </div>
          ))}
        </div>

        {locError && (
          <div className="absolute top-3 left-1/2 z-[1000] -translate-x-1/2 rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-xs text-red-700 shadow">
            {locError}
          </div>
        )}

        {pinned.length === 0 && (
          <div className="absolute inset-0 z-[500] flex items-center justify-center rounded-2xl bg-white/60 backdrop-blur-sm">
            <p className="text-sm text-stone-500">No members have shared their location yet.</p>
          </div>
        )}
      </div>
    </>
  );
}
