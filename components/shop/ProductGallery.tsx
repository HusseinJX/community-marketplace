"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

/**
 * The photographs of one variant — every angle Printify shot, not just the
 * cover.
 *
 * Deliberately dumb: it shows the list it is given and remembers which one is
 * open. The DECISION of which list that is belongs to whoever owns the size and
 * colour choice, because the picture and the price have to describe the same
 * object. Changing the list resets to its first image (the default mockup), so
 * choosing Navy shows the front of the navy one rather than the back of it.
 */
export function ProductGallery({ images, alt }: { images: string[]; alt: string }) {
  const [index, setIndex] = useState(0);
  const key = images.join("|");

  useEffect(() => {
    setIndex(0);
  }, [key]);

  const current = images[Math.min(index, images.length - 1)];

  return (
    <div>
      <div className="relative aspect-square overflow-hidden rounded-2xl bg-stone-100">
        {current ? (
          <Image
            src={current}
            alt={alt}
            fill
            sizes="(min-width:768px) 480px, 100vw"
            // CONTAIN, not cover: these are studio mockups shot on white, and
            // cropping a t-shirt to a square cuts the print off the front.
            className="object-contain"
            priority
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-stone-400">
            No photo yet
          </div>
        )}
      </div>

      {/* One photo is not a gallery — a lone thumbnail under it is a control
          that does nothing. */}
      {images.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {images.map((src, i) => (
            <button
              key={src}
              onClick={() => setIndex(i)}
              aria-label={`Photo ${i + 1} of ${images.length}`}
              aria-pressed={i === index}
              className={
                "relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border bg-stone-100 transition " +
                (i === index ? "border-stone-900" : "border-stone-200 hover:border-stone-400")
              }
            >
              <Image src={src} alt="" fill sizes="64px" className="object-contain" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
