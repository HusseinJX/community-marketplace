"use client";

import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
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

export default function MapViewInner({ members }: { members: Member[] }) {
  const pinned = members.filter(
    (m) => typeof m.profile?.latitude === "number" && typeof m.profile?.longitude === "number"
  );

  const mapCenter: [number, number] =
    pinned.length > 0
      ? [pinned[0].profile!.latitude as number, pinned[0].profile!.longitude as number]
      : [37.7749, -122.4194];

  return (
    <div className="relative">
      <MapContainer
        center={mapCenter}
        zoom={pinned.length > 0 ? 11 : 4}
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

      {pinned.length === 0 && (
        <div className="absolute inset-0 z-[500] flex items-center justify-center rounded-2xl bg-white/60 backdrop-blur-sm">
          <p className="text-sm text-stone-500">No members have shared their location yet.</p>
        </div>
      )}
    </div>
  );
}
