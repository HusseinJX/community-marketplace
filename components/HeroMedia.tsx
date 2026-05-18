"use client";

import { useState } from "react";

// Hero image with graceful fallback to the type-coloured gradient when:
// - no images supplied
// - all URLs are known placeholder garbage
// - the browser fails to load the URL (404/504/CORS)
//
// Used by MemberCard so imported profiles with image_url from external
// (sometimes flaky) sources don't render as broken-image icons.

// Known generic placeholder URLs we'd rather skip than show.
const PLACEHOLDER_HINTS = [
  "photo-1441986300917-64674bd600d8", // the prolocaliq seed-data unsplash
];

function isPlaceholder(url: string) {
  if (!url) return true;
  return PLACEHOLDER_HINTS.some((h) => url.includes(h));
}

export function HeroMedia({
  images,
  gradientClass,
  alt,
  aspect = "video",
}: {
  images?: string[];
  gradientClass: string; // e.g. "from-blue-300 to-indigo-400"
  alt: string;
  aspect?: "video" | "square";
}) {
  const usable = (images || []).filter((u) => u && !isPlaceholder(u));
  const [errored, setErrored] = useState(false);
  const aspectClass = aspect === "square" ? "aspect-square" : "aspect-[16/10]";

  if (usable.length === 0 || errored) {
    return <div className={`${aspectClass} w-full bg-gradient-to-br ${gradientClass}`} />;
  }

  return (
    <div className={`relative ${aspectClass} w-full overflow-hidden bg-stone-100`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={usable[0]}
        alt={alt}
        loading="lazy"
        onError={() => setErrored(true)}
        className="h-full w-full object-cover"
        draggable={false}
      />
    </div>
  );
}
