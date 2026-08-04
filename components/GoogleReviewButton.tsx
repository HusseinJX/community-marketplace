"use client";

import useSWR from "swr";
import { Star } from "lucide-react";
import { mapsSearchUrl, reviewQuery, writeReviewUrl } from "@/lib/google-review";

// One-click "Leave a Google review" button → opens Google's write-a-review
// composer directly. Businesses onboarded via Google Places already carry a
// `placeId`, so we use it verbatim (exact, instant, no API call). Only when
// it's missing do we resolve one from name+address via /api/places/review-link
// (cached), with a Maps URL / search fallback so the button is never dead.
export function GoogleReviewButton({
  placeId,
  name,
  address,
  mapsUrl,
  className,
}: {
  placeId?: string | null;
  name?: string | null;
  address?: string | null;
  mapsUrl?: string | null;
  /** Override the default styling (e.g. to sit inline in a button row). */
  className?: string;
}) {
  const q = reviewQuery(name, address);
  // Skip the network entirely when we already know the Place ID.
  const { data } = useSWR<{ url: string | null; direct: boolean }>(
    !placeId && q ? `/api/places/review-link?q=${encodeURIComponent(q)}` : null
  );

  const href = placeId
    ? writeReviewUrl(placeId)
    : data?.url || mapsUrl || (q ? mapsSearchUrl(q) : null);
  if (!href) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={
        className ??
        "mt-4 inline-flex items-center gap-1.5 rounded-full bg-amber-400 px-3.5 py-2 text-[13px] font-semibold text-stone-900 shadow-sm transition hover:bg-amber-300"
      }
    >
      <Star className="h-4 w-4 fill-current" />
      Leave a Google review
    </a>
  );
}
