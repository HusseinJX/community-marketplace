"use client";

import dynamic from "next/dynamic";
import type { Member } from "@/lib/types";

const MapViewInner = dynamic(() => import("./MapViewInner"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[520px] items-center justify-center rounded-2xl border border-stone-200 bg-stone-50 text-sm text-stone-400">
      Loading map...
    </div>
  ),
});

export function MapView({ members }: { members: Member[] }) {
  return <MapViewInner members={members} />;
}
