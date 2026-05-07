"use client";

import { MapContainer, TileLayer, CircleMarker } from "react-leaflet";
import "leaflet/dist/leaflet.css";

export default function MiniMapInner({
  lat,
  lng,
  color = "#3B82F6",
}: {
  lat: number;
  lng: number;
  color?: string;
}) {
  return (
    <MapContainer
      center={[lat, lng]}
      zoom={14}
      scrollWheelZoom={false}
      dragging={false}
      zoomControl={false}
      attributionControl={false}
      style={{ height: "180px", width: "100%", borderRadius: "0.75rem" }}
      className="z-0"
    >
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <CircleMarker
        center={[lat, lng]}
        radius={9}
        fillColor={color}
        color="white"
        weight={2}
        fillOpacity={0.9}
      />
    </MapContainer>
  );
}
