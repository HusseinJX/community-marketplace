"use client";

import Image from "next/image";
import { useState } from "react";
import { usableImages } from "@/lib/image-utils";

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
  aspect?: "video" | "square" | "tall";
  priority?: boolean;
}) {
  const usable = usableImages(images);
  const [errored, setErrored] = useState(false);
  const aspectClass =
    aspect === "square" ? "aspect-square" : aspect === "tall" ? "aspect-[4/5]" : "aspect-[16/10]";

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
