"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Popup, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import Link from "next/link";
import type { Member, MemberType } from "@/lib/types";
import { nativeGeoAvailable, getNativePosition } from "@/lib/native-geo";

const TYPE_COLORS: Record<MemberType | "unknown", string> = {
  vendor:     "#3B82F6",
  artist:     "#8B5CF6",
  organizer:  "#10B981",
  shopper:    "#F97316",
  influencer: "#EC4899",
  unknown:    "#6B7280",
};

// Lucide-derived SVG path data. All icons are 24×24, stroke-width 2, rounded
// caps/joins. Keys map to whichever member subcategory/memberType matched.
// To add a new icon, copy the inner <path>/<line>/<circle>/<polyline>/<rect>
// elements from https://lucide.dev/icons here.
const ICON_SVG: Record<string, string> = {
  utensils:    `<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>`,
  coffee:      `<path d="M17 8h1a4 4 0 1 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/><line x1="6" y1="2" x2="6" y2="4"/><line x1="10" y1="2" x2="10" y2="4"/><line x1="14" y1="2" x2="14" y2="4"/>`,
  beer:        `<path d="M17 11h1a3 3 0 0 1 0 6h-1"/><path d="M9 12v6"/><path d="M13 12v6"/><path d="M14 7.5c-1 0-1.44.5-3 .5s-2-.5-3-.5-1.72.5-2.5.5a2.5 2.5 0 0 1 0-5c.78 0 1.57.5 2.5.5C9.44 3.5 10 3 12 3s2.56.5 4 .5c.93 0 1.72-.5 2.5-.5a2.5 2.5 0 0 1 0 5c-.78 0-1.5-.5-2.5-.5Z"/><path d="M5 8v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8"/>`,
  cake:        `<path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8"/><path d="M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2-1 2-1"/><path d="M2 21h20"/><path d="M7 8v3"/><path d="M12 8v3"/><path d="M17 8v3"/><path d="M7 4h.01"/><path d="M12 4h.01"/><path d="M17 4h.01"/>`,
  music:       `<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>`,
  palette:     `<circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>`,
  book:        `<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>`,
  shirt:       `<path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z"/>`,
  gift:        `<polyline points="20 12 20 22 4 22 4 12"/><rect width="20" height="5" x="2" y="7"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>`,
  home:        `<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>`,
  car:         `<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/>`,
  heart:       `<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>`,
  leaf:        `<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19.2 2.96a1 1 0 0 1 1.6.8c0 6.39-3.81 11.59-9.41 12.16A6.93 6.93 0 0 1 11 17"/><path d="M2 21c0-3 1.85-5.36 5.08-6"/>`,
  camera:      `<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>`,
  flower:      `<circle cx="12" cy="12" r="3"/><path d="M12 9a3 3 0 0 0-3-3 3 3 0 0 0 6 0 3 3 0 0 0-3 3z"/><path d="M12 15a3 3 0 0 1-3 3 3 3 0 0 1 6 0 3 3 0 0 1-3-3z"/><path d="M15 12a3 3 0 0 1 3-3 3 3 0 0 1 0 6 3 3 0 0 1-3-3z"/><path d="M9 12a3 3 0 0 0-3 3 3 3 0 0 0 0-6 3 3 0 0 0 3 3z"/>`,
  briefcase:   `<rect width="20" height="14" x="2" y="7" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>`,
  users:       `<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>`,
  store:       `<path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/><path d="M22 7v3a2 2 0 0 1-2 2v0a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12v0a2 2 0 0 1-2-2V7"/>`,
  yoga:        `<circle cx="12" cy="5" r="2"/><path d="M12 7v4l-3 8m6-8v8m-7-2h8"/>`,
  paintbrush:  `<path d="M18.37 2.63 14 7l-1.59-1.59a2 2 0 0 0-2.82 0L8 7l9 9 1.59-1.59a2 2 0 0 0 0-2.82L17 10l4.37-4.37a2.12 2.12 0 1 0-3-3Z"/><path d="M9 8 8 17l-5 5"/><path d="m9 21 3-3"/>`,
};

// Decide which icon + color a member should get on the map. Order matters:
// memberType wins for artist/organizer; vendors fall through to subcategory
// or category keywords.
function iconForMember(m: Member): { key: string; color: string } {
  const p = m.profile || {};
  const type = (p.memberType || "").toLowerCase();
  const sub = (p.subcategory || "").toLowerCase();
  const cat = (p.category || "").toLowerCase();
  const text = `${type} ${cat} ${sub} ${(p.discipline || "").toString().toLowerCase()}`;

  if (type === "organizer") return { key: "users", color: TYPE_COLORS.organizer };
  if (type === "artist") {
    if (/music|band|dj|sound|audio/.test(text)) return { key: "music", color: TYPE_COLORS.artist };
    if (/photo/.test(text)) return { key: "camera", color: TYPE_COLORS.artist };
    if (/film|video/.test(text)) return { key: "camera", color: TYPE_COLORS.artist };
    return { key: "palette", color: TYPE_COLORS.artist };
  }

  // Vendors — choose by subcategory keywords.
  const vendorColor = TYPE_COLORS.vendor;
  if (/restaurant|catering|food|kitchen/.test(text)) return { key: "utensils", color: vendorColor };
  if (/caf[eé]|coffee|tea/.test(text)) return { key: "coffee", color: vendorColor };
  if (/bar|pub|brew|wine|saloon|tavern|lounge/.test(text)) return { key: "beer", color: vendorColor };
  if (/bakery|bakeries|cake/.test(text)) return { key: "cake", color: vendorColor };
  if (/book/.test(text)) return { key: "book", color: vendorColor };
  if (/gallery|art|mural/.test(text)) return { key: "palette", color: vendorColor };
  if (/cloth|apparel|accessor/.test(text)) return { key: "shirt", color: vendorColor };
  if (/gift|home goods|home/.test(text)) return { key: "gift", color: vendorColor };
  if (/auto|car|repair/.test(text)) return { key: "car", color: vendorColor };
  if (/yoga|fitness|wellness/.test(text)) return { key: "yoga", color: vendorColor };
  if (/health|mental|nutrition|salon|spa/.test(text)) return { key: "heart", color: vendorColor };
  if (/flower|florist/.test(text)) return { key: "flower", color: vendorColor };
  if (/photo|video/.test(text)) return { key: "camera", color: vendorColor };
  if (/consult|service|professional/.test(text)) return { key: "briefcase", color: vendorColor };

  return { key: "store", color: vendorColor };
}

function buildPinIcon(key: string, color: string): L.DivIcon {
  const svg = ICON_SVG[key] || ICON_SVG.store;
  const html = `
    <div style="
      position:relative;width:32px;height:40px;display:flex;align-items:flex-start;justify-content:center;
      filter:drop-shadow(0 2px 3px rgba(0,0,0,0.35));
    ">
      <svg width="32" height="40" viewBox="0 0 32 40" xmlns="http://www.w3.org/2000/svg">
        <path d="M16 1 C7.7 1 1 7.7 1 16 c0 8.3 11 20 14.3 22.5 a1 1 0 0 0 1.4 0 C20 36 31 24.3 31 16 31 7.7 24.3 1 16 1 Z"
              fill="${color}" stroke="white" stroke-width="2"/>
        <g transform="translate(8 6) scale(0.667)" fill="none" stroke="white" stroke-width="2"
           stroke-linecap="round" stroke-linejoin="round">
          ${svg}
        </g>
      </svg>
    </div>`;
  return L.divIcon({
    html,
    className: "",
    iconSize: [32, 40],
    iconAnchor: [16, 38],
    popupAnchor: [0, -34],
  });
}

const LEGEND: { key: string; label: string; color: string }[] = [
  { key: "store",    label: "Vendor",     color: TYPE_COLORS.vendor },
  { key: "utensils", label: "Food & Drink", color: TYPE_COLORS.vendor },
  { key: "music",    label: "Artist",     color: TYPE_COLORS.artist },
  { key: "users",    label: "Community",  color: TYPE_COLORS.organizer },
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

  // Lock the initial center so filter changes don't re-instantiate the Leaflet
  // map (MapContainer only uses `center` on mount). Fall back to downtown SF
  // when nothing is pinned yet.
  const [mapCenter] = useState<[number, number]>(() =>
    pinned.length > 0
      ? [pinned[0].profile!.latitude as number, pinned[0].profile!.longitude as number]
      : [37.7749, -122.4194]
  );

  async function handleLocate() {
    setLocating(true);
    setLocError(null);
    // Inside the iOS app, WKWebView has no navigator.geolocation — use the native
    // Capacitor plugin; on the web, fall back to the browser API.
    if (nativeGeoAvailable()) {
      try {
        setUserPos(await getNativePosition());
      } catch {
        setLocError("Could not get your location. Check location permissions.");
      } finally {
        setLocating(false);
      }
      return;
    }
    if (!navigator.geolocation) {
      setLocError("Geolocation not supported by your browser.");
      setLocating(false);
      return;
    }
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
          zoom={12}
          style={{ height: "520px", width: "100%", borderRadius: "1rem" }}
          className="z-0"
        >
          {process.env.NEXT_PUBLIC_MAPBOX_TOKEN ? (
            <TileLayer
              attribution='&copy; <a href="https://www.mapbox.com/about/maps/" target="_blank" rel="noreferrer">Mapbox</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>'
              url={`https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/{z}/{x}/{y}@2x?access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}`}
              tileSize={512}
              zoomOffset={-1}
            />
          ) : (
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
          )}

          {pinned.map((m) => {
            const { key, color } = iconForMember(m);
            const name = (m.profile?.name as string) || "Member";
            const location = [m.profile?.neighborhood, m.profile?.city].filter(Boolean).join(", ");
            return (
              <Marker
                key={m.id}
                position={[m.profile!.latitude as number, m.profile!.longitude as number]}
                icon={buildPinIcon(key, color)}
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
              </Marker>
            );
          })}

          <LocationControl
            userPos={userPos}
            onLocate={handleLocate}
            locating={locating}
          />
        </MapContainer>

        {/* Legend */}
        <div className="absolute bottom-4 left-4 z-[1000] flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-stone-200 bg-white/90 px-3 py-2 shadow backdrop-blur-sm">
          {LEGEND.map(({ key, label, color }) => (
            <div key={label} className="flex items-center gap-1.5">
              <span
                className="inline-flex h-5 w-5 items-center justify-center rounded-full"
                style={{ backgroundColor: color }}
                aria-hidden
                dangerouslySetInnerHTML={{
                  __html: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${ICON_SVG[key] || ICON_SVG.store}</svg>`,
                }}
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
