"use client";

import dynamic from "next/dynamic";

const MiniMapInner = dynamic(() => import("./MiniMapInner"), {
  ssr: false,
  loading: () => (
    <div className="h-[180px] w-full rounded-xl bg-stone-100 animate-pulse" />
  ),
});

export function MiniMap({
  lat,
  lng,
  color,
}: {
  lat: number;
  lng: number;
  color?: string;
}) {
  return <MiniMapInner lat={lat} lng={lng} color={color} />;
}
