"use client";

import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// A calm pin (event 📅) — no pulse, this is a static "here's the venue" map.
function pinIcon(): L.DivIcon {
  const html = `
    <div style="position:relative;width:34px;height:34px;">
      <div style="position:absolute;top:3px;left:3px;width:28px;height:28px;border-radius:9999px;background:white;border:2.5px solid #4f46e5;display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 1px 5px rgba(0,0,0,0.3);">📍</div>
    </div>`;
  return L.divIcon({ html, className: "", iconSize: [34, 34], iconAnchor: [17, 17], popupAnchor: [0, -16] });
}

export default function EventLocationMapInner({
  lat,
  lng,
  label,
}: {
  lat: number;
  lng: number;
  label?: string;
}) {
  return (
    <MapContainer
      center={[lat, lng]}
      zoom={15}
      scrollWheelZoom={false}
      style={{ height: "10rem", width: "100%", borderRadius: "0.75rem" }}
      className="z-0"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Marker position={[lat, lng]} icon={pinIcon()}>
        {label && <Popup>{label}</Popup>}
      </Marker>
    </MapContainer>
  );
}
