import { NextResponse } from "next/server";
import { writeReviewUrl, mapsSearchUrl } from "@/lib/google-review";

// Resolve the best "leave a Google review" link for a business by name+address.
// If we can find its Google Place ID we return the direct write-a-review
// composer deep link (true one-click); otherwise a Maps search for the listing
// (review is one tap from there). The Places call is cached a day per query —
// listings + place ids are stable, so Google is hit at most ~once/day/business.
export async function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get("q") || "").trim();
  if (!q) return NextResponse.json({ url: null, direct: false });

  const key = process.env.GOOGLE_PLACES_API_KEY;
  const fallback = { url: mapsSearchUrl(q), direct: false };
  if (!key) return NextResponse.json(fallback);

  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(q)}&key=${key}`,
      { next: { revalidate: 86400 }, signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return NextResponse.json(fallback);
    const data = await res.json();
    const placeId = data.results?.[0]?.place_id;
    if (placeId) {
      return NextResponse.json({ url: writeReviewUrl(String(placeId)), direct: true, placeId });
    }
    return NextResponse.json(fallback);
  } catch {
    return NextResponse.json(fallback);
  }
}
