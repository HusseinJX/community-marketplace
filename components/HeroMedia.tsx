"use client";

import Image from "next/image";
import { useState } from "react";

// Single hero image with:
// - next/image edge-resized AVIF/WebP (Netlify image optimizer)
// - lazy load below the fold
// - graceful fallback to type-coloured gradient on load error
// - junk-placeholder URL filter

const PLACEHOLDER_HINTS = [
  "photo-1441986300917-64674bd600d8", // prolocaliq seed unsplash garbage
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
  priority,
}: {
  images?: string[];
  gradientClass: string;
  alt: string;
  aspect?: "video" | "square";
  priority?: boolean;
}) {
  const usable = (images || []).filter((u) => u && !isPlaceholder(u));
  const [errored, setErrored] = useState(false);
  const aspectClass = aspect === "square" ? "aspect-square" : "aspect-[16/10]";

  if (usable.length === 0 || errored) {
    return <div className={`${aspectClass} w-full bg-gradient-to-br ${gradientClass}`} />;
  }

  return (
    <div className={`relative ${aspectClass} w-full overflow-hidden bg-stone-100`}>
      <Image
        src={usable[0]}
        alt={alt}
        fill
        sizes="(min-width:1024px) 320px, (min-width:640px) 50vw, 100vw"
        className="object-cover"
        loading={priority ? "eager" : "lazy"}
        priority={priority}
        onError={() => setErrored(true)}
      />
    </div>
  );
}
