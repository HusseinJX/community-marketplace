"use client";

import { useEffect, useMemo, useRef } from "react";
import { MapContainer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapPin } from "lucide-react";
import { BaseTiles } from "@/components/map/BaseTiles";
import type { MapPoint } from "@/components/home/split-types";

/**
 * The map half of an expanded category — for shops, events, anything with a
 * position. Works on `MapPoint`, so it never learns what it is drawing.
 *
 * ── Pins, not labels ─────────────────────────────────────────────────────────
 * This started as Airbnb-style markers carrying the name, and it did not
 * survive contact with the data: a price is six characters, whereas "Dianda's
 * Italian American Pastry Company" is forty, and two dozen in a dense downtown
 * overlapped into an unreadable pile. Truncating helped and wasn't enough — a
 * truncated name is the least useful half of a name. So the pin carries the one
 * thing that IS short: what KIND of thing it is. The name lives in the popup or
 * the sheet card, where there's room for all of it.
 *
 * ── The pairing ──────────────────────────────────────────────────────────────
 * `hoveredId` comes from whatever owns both this and the list beside it, never
 * from here. Hovering a card inverts its pin and lifts it above its neighbours;
 * hovering a pin highlights the card. That two-way link is what makes the two
 * panes read as one surface rather than a list next to an unrelated map.
 */

function markerIcon(emoji: string, active: boolean): L.DivIcon {
  const size = active ? 38 : 32;
  const bg = active ? "#292524" : "#ffffff";
  const ring = active ? "#292524" : "rgba(0,0,0,0.10)";
  const html = `
    <div style="
      width:${size}px;height:${size}px;border-radius:9999px;
      background:${bg};border:1.5px solid ${ring};
      display:flex;align-items:center;justify-content:center;
      font-size:${active ? 18 : 15}px;line-height:1;
      box-shadow:0 2px 8px -1px rgba(0,0,0,0.25);
      transition:width .12s ease,height .12s ease;
    ">${emoji}</div>`;
  return L.divIcon({
    html,
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -(size / 2) - 2],
  });
}

/** Refit the viewport whenever the set of places changes. */
function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  const key = points.map((p) => p.join(",")).join("|");
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 14);
      return;
    }
    map.fitBounds(L.latLngBounds(points), { padding: [48, 48], maxZoom: 15 });
    // `key` stands in for the point list — a new array identity every render
    // would refit the map on every parent re-render, including a hover.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map]);
  return null;
}

/**
 * Reports pans and zooms upward.
 *
 * `dragstart`/`zoomstart` and NOT `move`: those two fire once per gesture, at
 * the moment the reader takes hold of the map. `move` also fires for every
 * programmatic `fitBounds` and `setView`, which would make the mobile sheet
 * duck away on first paint, and again every time a card was selected.
 */
function InteractionReporter({ onInteract }: { onInteract: () => void }) {
  const map = useMap();
  useEffect(() => {
    const fn = () => onInteract();
    map.on("dragstart", fn);
    map.on("zoomstart", fn);
    return () => {
      map.off("dragstart", fn);
      map.off("zoomstart", fn);
    };
  }, [map, onInteract]);
  return null;
}

export default function SplitMapInner({
  points,
  hoveredId,
  onHover,
  onSelect,
  onInteract,
  fit = true,
  renderPopup,
}: {
  points: MapPoint[];
  hoveredId: string | null;
  onHover: (id: string | null) => void;
  /**
   * Tapping a pin picks it instead of opening Leaflet's popup. Used by the
   * mobile sheet, which shows the chosen thing as a card in the panel — a
   * popup floating over a map that already has a panel below it is two answers
   * to one question, and the popup is the one you can't scroll.
   */
  onSelect?: (id: string) => void;
  /** The reader panned or zoomed. The sheet uses this to get out of the way. */
  onInteract?: () => void;
  /** Refit the viewport to the pins. Off once the reader has moved the map. */
  fit?: boolean;
  /** Desktop popup contents. Omitted in select mode. */
  renderPopup?: (id: string) => React.ReactNode;
}) {
  const coords = useMemo(
    () => points.map((p) => [p.lat, p.lng] as [number, number]),
    [points],
  );
  const center: [number, number] = coords[0] ?? [37.7749, -122.4194];

  // Leaflet lays out against the container's size at mount. Inside a pane that
  // is revealed rather than present from the start, that size can be zero, and
  // the map renders as a grey box until something forces a reflow.
  const ref = useRef<L.Map | null>(null);
  useEffect(() => {
    const id = window.setTimeout(() => ref.current?.invalidateSize(), 120);
    return () => window.clearTimeout(id);
  }, []);

  if (points.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center rounded-[var(--r-lg)] border border-dashed border-stone-300 bg-white/60 p-6 text-center">
        <MapPin className="mb-2 h-6 w-6 text-stone-300" />
        <p className="t-strong text-stone-700">Nothing to map here.</p>
        <p className="t-meta mt-1 text-stone-500">None of these have a known location yet.</p>
      </div>
    );
  }

  return (
    <MapContainer
      ref={ref}
      center={center}
      zoom={12}
      // Fully interactive, because this pane is the point of the split view
      // rather than a decorative inset. Scroll-wheel zoom is normally a trap —
      // it hijacks the page scroll when a cursor crosses a map — but here the
      // map is a sticky panel that does NOT scroll with the page, so a wheel
      // over it can only have meant the map.
      scrollWheelZoom
      // Leaflet defaults that get silently lost the moment you start passing
      // interaction props, so they are stated.
      boxZoom
      doubleClickZoom
      dragging
      touchZoom
      style={{ height: "100%", width: "100%" }}
      className="z-0 rounded-[var(--r-lg)]"
    >
      <BaseTiles />
      {fit && <FitBounds points={coords} />}
      {onInteract && <InteractionReporter onInteract={onInteract} />}

      {points.map((p) => {
        const active = hoveredId === p.id;
        return (
          <Marker
            key={p.id}
            position={[p.lat, p.lng]}
            icon={markerIcon(p.emoji, active)}
            title={p.title}
            // Above its neighbours while active, so a highlighted pin is never
            // half-hidden under the one next to it.
            zIndexOffset={active ? 1000 : 0}
            eventHandlers={{
              mouseover: () => onHover(p.id),
              mouseout: () => onHover(null),
              ...(onSelect ? { click: () => onSelect(p.id) } : null),
            }}
          >
            {!onSelect && renderPopup && <Popup>{renderPopup(p.id)}</Popup>}
          </Marker>
        );
      })}
    </MapContainer>
  );
}
