// Helpers for "leave a Google review" deep links.

/**
 * Google's direct write-a-review composer — opens the review dialog straight
 * away for a business (true one-click). Requires the business's Google Place ID.
 */
export function writeReviewUrl(placeId: string): string {
  return `https://search.google.com/local/writereview?placeid=${encodeURIComponent(placeId)}`;
}

/** Fallback: a Google Maps search for the listing (review is one tap from there). */
export function mapsSearchUrl(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/** Search string that best identifies a business on Google. */
export function reviewQuery(name?: string | null, address?: string | null): string {
  return [name, address].filter(Boolean).join(" ").trim();
}
