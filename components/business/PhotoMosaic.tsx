"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { Grid3x3, X, ChevronLeft, ChevronRight } from "lucide-react";
import { ImageCarousel } from "@/components/ImageCarousel";

/**
 * The listing hero: one large photo with a 2×2 grid beside it.
 *
 * ── Why not the carousel it replaced ─────────────────────────────────────────
 * The hero was a single 21:9 carousel, which shows exactly one photo at a time
 * and asks you to work for the rest. A business that has done the work of
 * photographing itself got no credit for it above the fold, and a visitor had
 * no sense of how much there was to see.
 *
 * A mosaic shows five at once. That is most of why a listing page feels
 * generous rather than thin, and it costs nothing we weren't already loading.
 *
 * Phones keep the carousel — there is no room for a mosaic on a 390px screen,
 * and swiping is the right gesture there anyway. Same split every listing site
 * makes.
 *
 * Fewer than five photos is handled by the layout, not by a special case: with
 * two or three the grid simply has fewer cells and the big photo still leads.
 */
export function PhotoMosaic({
  images,
  alt,
  gradientClass,
}: {
  images: string[];
  alt: string;
  gradientClass: string;
}) {
  const [lightbox, setLightbox] = useState<number | null>(null);

  if (images.length === 0) {
    return <div className={`aspect-[21/9] w-full rounded-[var(--r-lg)] bg-gradient-to-br ${gradientClass}`} />;
  }

  // One photo can't be a mosaic — it's just a photo, full width.
  if (images.length === 1) {
    return (
      <button
        onClick={() => setLightbox(0)}
        className="relative block aspect-[16/9] w-full overflow-hidden rounded-[var(--r-lg)] bg-stone-100"
      >
        <Image src={images[0]} alt={alt} fill sizes="(min-width:1280px) 1200px, 100vw" className="object-cover" priority />
        <Lightbox images={images} alt={alt} index={lightbox} onClose={() => setLightbox(null)} onIndex={setLightbox} />
      </button>
    );
  }

  const [lead, ...rest] = images;
  const grid = rest.slice(0, 4);

  return (
    <>
      {/* Phone — the carousel, unchanged. */}
      <div className="md:hidden">
        <ImageCarousel images={images} alt={alt} aspect="video" fallbackGradient={gradientClass} priority />
      </div>

      {/* Desktop — mosaic. Rounded on the OUTER corners only, so the five
          photos read as one object rather than five loose tiles. */}
      <div className="relative hidden h-[420px] gap-2 overflow-hidden rounded-[var(--r-lg)] md:grid md:grid-cols-2">
        <Tile src={lead} alt={alt} sizes="(min-width:1280px) 600px, 50vw" priority onClick={() => setLightbox(0)} />

        <div className={`grid gap-2 ${grid.length > 2 ? "grid-cols-2 grid-rows-2" : "grid-rows-2"}`}>
          {grid.map((src, i) => (
            <Tile
              key={src + i}
              src={src}
              alt={alt}
              sizes="(min-width:1280px) 300px, 25vw"
              onClick={() => setLightbox(i + 1)}
            />
          ))}
        </div>

        {images.length > 5 && (
          <button
            onClick={() => setLightbox(0)}
            className="absolute bottom-4 right-4 inline-flex items-center gap-2 rounded-[var(--r-md)] border border-stone-900/10 bg-white px-3.5 py-2 t-meta font-semibold text-stone-900 shadow-[var(--shadow-float)] transition hover:scale-[1.02]"
          >
            <Grid3x3 className="h-4 w-4" />
            Show all {images.length} photos
          </button>
        )}
      </div>

      <Lightbox images={images} alt={alt} index={lightbox} onClose={() => setLightbox(null)} onIndex={setLightbox} />
    </>
  );
}

function Tile({
  src,
  alt,
  sizes,
  priority,
  onClick,
}: {
  src: string;
  alt: string;
  sizes: string;
  priority?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group relative h-full w-full overflow-hidden bg-stone-100"
      aria-label="Open photo"
    >
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        className="object-cover transition duration-300 group-hover:scale-[1.03]"
        priority={priority}
      />
      {/* A wash on hover, so it's obvious the photo is a target. Airbnb does
          the same and it's the only hover state the mosaic needs. */}
      <span className="absolute inset-0 bg-stone-900/0 transition group-hover:bg-stone-900/10" />
    </button>
  );
}

/** Full-screen photo viewer. Portalled — see FilterSidebar for why that matters. */
function Lightbox({
  images,
  alt,
  index,
  onClose,
  onIndex,
}: {
  images: string[];
  alt: string;
  index: number | null;
  onClose: () => void;
  onIndex: (i: number) => void;
}) {
  const open = index !== null;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onIndex(((index ?? 0) + 1) % images.length);
      if (e.key === "ArrowLeft") onIndex(((index ?? 0) - 1 + images.length) % images.length);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, index, images.length, onClose, onIndex]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[90] flex flex-col bg-stone-950/95" onClick={onClose}>
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <button onClick={onClose} aria-label="Close" className="rounded-full p-2 transition hover:bg-white/10">
          <X className="h-5 w-5" />
        </button>
        <span className="t-meta tabular-nums text-white/70">
          {(index ?? 0) + 1} / {images.length}
        </span>
        <span className="w-9" />
      </div>

      <div className="relative flex-1" onClick={(e) => e.stopPropagation()}>
        <Image
          src={images[index ?? 0]}
          alt={alt}
          fill
          sizes="100vw"
          className="object-contain"
        />
        {images.length > 1 && (
          <>
            <LightboxArrow
              side="left"
              onClick={() => onIndex(((index ?? 0) - 1 + images.length) % images.length)}
            />
            <LightboxArrow
              side="right"
              onClick={() => onIndex(((index ?? 0) + 1) % images.length)}
            />
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}

function LightboxArrow({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      onClick={onClick}
      aria-label={side === "left" ? "Previous photo" : "Next photo"}
      className={`absolute top-1/2 ${side === "left" ? "left-3" : "right-3"} grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-stone-900 transition hover:bg-white`}
    >
      <Icon className="h-5 w-5" />
    </button>
  );
}
