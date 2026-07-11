"use client";

import { useMemo, useRef } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const SF: [number, number] = [37.7749, -122.4194];

function pinIcon(): L.DivIcon {
  const html = `
    <div style="position:relative;width:34px;height:34px;">
      <div style="position:absolute;top:3px;left:3px;width:28px;height:28px;border-radius:9999px;background:white;border:2.5px solid #4f46e5;display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 1px 5px rgba(0,0,0,0.3);">📍</div>
    </div>`;
  return L.divIcon({ html, className: "", iconSize: [34, 34], iconAnchor: [17, 17], popupAnchor: [0, -16] });
}

// Click anywhere on the map to move the pin there.
function ClickToPlace({ onChange }: { onChange: (pos: [number, number]) => void }) {
  useMapEvents({
    click(e) {
      onChange([e.latlng.lat, e.latlng.lng]);
    },
  });
  return null;
}

export default function EventLocationPickerInner({
  value,
  onChange,
}: {
  value: [number, number] | null;
  onChange: (pos: [number, number]) => void;
}) {
  const pos = value ?? SF;
  const markerRef = useRef<L.Marker | null>(null);
  const icon = useMemo(() => pinIcon(), []);

  return (
    <MapContainer
      center={pos}
      zoom={14}
      style={{ height: "11rem", width: "100%", borderRadius: "0.75rem" }}
      className="z-0"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ClickToPlace onChange={onChange} />
      <Marker
        position={pos}
        icon={icon}
        draggable
        ref={markerRef}
        eventHandlers={{
          dragend() {
            const m = markerRef.current;
            if (m) {
              const ll = m.getLatLng();
              onChange([ll.lat, ll.lng]);
            }
          },
        }}
      />
    </MapContainer>
  );
}
