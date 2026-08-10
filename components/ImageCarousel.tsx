"use client";

import Image from "next/image";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { usableImages } from "@/lib/image-utils";

type Props = {
  images: string[];
  alt?: string;
  aspect?: "video" | "square" | "wide" | "tall";
  rounded?: string;
  showCounter?: boolean;
  /** Dots along the bottom edge. Off when something else sits there. */
  indicators?: boolean;
  fallbackGradient?: string;
  sizes?: string;
  /** JPEG/WebP quality. Default 75; posters justify more. */
  quality?: number;
  priority?: boolean;
};

const aspectClass: Record<NonNullable<Props["aspect"]>, string> = {
  video: "aspect-[16/10]",
  square: "aspect-square",
  wide: "aspect-[21/9]",
  tall: "aspect-[4/5]",
};

// "wide" is the profile-page hero (≈1100px on desktop). "video" / "square" are
// grid cards (≈320px). Defaults match these use cases so next/image picks an
// appropriately sized variant from the optimizer.
const defaultSizes: Record<NonNullable<Props["aspect"]>, string> = {
  wide: "(min-width:1280px) 1200px, 100vw",
  tall: "(min-width:1024px) 480px, (min-width:640px) 50vw, 100vw",
  video: "(min-width:1024px) 320px, (min-width:640px) 50vw, 100vw",
  square: "(min-width:1024px) 320px, (min-width:640px) 50vw, 100vw",
};

export function ImageCarousel({
  images,
  alt = "",
  aspect = "video",
  rounded = "rounded-2xl",
  showCounter = true,
  indicators = true,
  fallbackGradient,
  sizes,
  quality,
  priority,
}: Props) {
  const [i, setI] = useState(0);
  const [broken, setBroken] = useState<Set<number>>(() => new Set());
  const filtered = usableImages(images);
  if (filtered.length === 0) {
    if (fallbackGradient) {
      return <div className={`w-full ${rounded} ${aspectClass[aspect]} bg-gradient-to-br ${fallbackGradient}`} />;
    }
    return null;
  }
  const count = filtered.length;
  const allBroken = broken.size >= count;
  if (allBroken && fallbackGradient) {
    return <div className={`w-full ${rounded} ${aspectClass[aspect]} bg-gradient-to-br ${fallbackGradient}`} />;
  }
  const prev = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setI((n) => (n - 1 + count) % count);
  };
  const next = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setI((n) => (n + 1) % count);
  };

  return (
    <div className={`relative w-full overflow-hidden bg-stone-100 ${rounded} ${aspectClass[aspect]}`}>
      <div
        className="flex h-full w-full transition-transform duration-300 ease-out"
        style={{ transform: `translateX(-${i * 100}%)` }}
      >
        {filtered.map((src, idx) => (
          <div key={idx} className="relative h-full w-full shrink-0">
            {broken.has(idx) ? (
              <div className={`absolute inset-0 bg-gradient-to-br ${fallbackGradient ?? "from-stone-200 to-stone-300"}`} />
            ) : (
              <Image
                src={src}
                alt={alt}
                fill
                sizes={sizes ?? defaultSizes[aspect]}
                className="object-cover"
                loading={idx === 0 && priority ? "eager" : idx === 0 ? "eager" : "lazy"}
                priority={idx === 0 && priority}
                quality={quality ?? (aspect === "wide" ? 90 : 75)}
                draggable={false}
                onError={() => setBroken((b) => { const n = new Set(b); n.add(idx); return n; })}
              />
            )}
          </div>
        ))}
      </div>

      {count > 1 && (
        <>
          <button
            onClick={prev}
            aria-label="Previous image"
            className="absolute left-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-stone-700 shadow-sm backdrop-blur transition hover:bg-white"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={next}
            aria-label="Next image"
            className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-stone-700 shadow-sm backdrop-blur transition hover:bg-white"
          >
            <ChevronRight className="h-4 w-4" />
          </button>

          <div
            className={`absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-1.5 ${
              indicators ? "" : "hidden"
            }`}
          >
            {filtered.map((_, idx) => (
              <button
                key={idx}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setI(idx);
                }}
                aria-label={`Go to image ${idx + 1}`}
                className={`h-1.5 rounded-full transition-all ${idx === i ? "w-5 bg-white" : "w-1.5 bg-white/60"}`}
              />
            ))}
          </div>

          {showCounter && (
            <div className="absolute right-2 top-2 rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur">
              {i + 1}/{count}
            </div>
          )}
        </>
      )}
    </div>
  );
}
