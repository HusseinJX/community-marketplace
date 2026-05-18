"use client";

import Image from "next/image";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

type Props = {
  images: string[];
  alt?: string;
  aspect?: "video" | "square" | "wide" | "tall";
  rounded?: string;
  showCounter?: boolean;
};

const aspectClass: Record<NonNullable<Props["aspect"]>, string> = {
  video: "aspect-[16/10]",
  square: "aspect-square",
  wide: "aspect-[21/9]",
  tall: "aspect-[4/5]",
};

export function ImageCarousel({
  images,
  alt = "",
  aspect = "video",
  rounded = "rounded-2xl",
  showCounter = true,
}: Props) {
  const [i, setI] = useState(0);
  if (!images || images.length === 0) return null;
  const count = images.length;
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
        {images.map((src, idx) => (
          <div key={idx} className="relative h-full w-full shrink-0">
            <Image
              src={src}
              alt={alt}
              fill
              sizes="(min-width:1024px) 320px, (min-width:640px) 50vw, 100vw"
              className="object-cover"
              loading={idx === 0 ? "eager" : "lazy"}
              draggable={false}
            />
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

          <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-1.5">
            {images.map((_, idx) => (
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
