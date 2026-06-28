"use client";

import dynamic from "next/dynamic";
import type { LiveBroadcast } from "./types";

const LiveMapInner = dynamic(() => import("./LiveMapInner"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[520px] items-center justify-center rounded-2xl border border-stone-200 bg-stone-50 text-sm text-stone-400">
      Loading map...
    </div>
  ),
});

export function LiveMap({ broadcasts }: { broadcasts: LiveBroadcast[] }) {
  return <LiveMapInner broadcasts={broadcasts} />;
}
