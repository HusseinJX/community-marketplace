"use client";

import useSWR from "swr";
import { Star } from "lucide-react";
import { mapsSearchUrl, reviewQuery } from "@/lib/google-review";

// One-click "Leave a Google review" button. Resolves the business's Google
// Place ID (cached server-side) so the link opens Google's write-a-review
// composer directly. Until that resolves — or if the business isn't found — it
// falls back to the known Maps URL / a Maps search so the button is always
// clickable, then upgrades to the direct composer link.
export function GoogleReviewButton({
  name,
  address,
  mapsUrl,
}: {
  name?: string | null;
  address?: string | null;
  mapsUrl?: string | null;
}) {
  const q = reviewQuery(name, address);
  const { data } = useSWR<{ url: string | null; direct: boolean }>(
    q ? `/api/places/review-link?q=${encodeURIComponent(q)}` : null
  );

  const href = data?.url || mapsUrl || (q ? mapsSearchUrl(q) : null);
  if (!href) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-stone-900 shadow-sm transition hover:bg-amber-300"
    >
      <Star className="h-4 w-4 fill-current" />
      Leave a Google review
    </a>
  );
}
