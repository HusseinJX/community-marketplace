import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { createPost, invalidatePosts } from "@/lib/posts";
import { isAdmin } from "@/lib/admin";
import { rateLimit } from "@/lib/rate-limit";
import { screen } from "@/lib/ai-moderation";
import { logModerationEvent, attachModerationContentId } from "@/lib/moderation";
import { reverseGeocode } from "@/lib/places";

export const runtime = "nodejs";

// A piece of public art, posted by the admin who photographed it and credited
// to every artist on it.
//
// This is a post like any other — it lands in `posts`, it appears in the feed,
// and it shows on each tagged artist's profile through post_member_tags. What
// makes it its own route rather than a flag on /api/posts is the multi-tag: the
// share composer tags ONE thing, and bending it to take a list would complicate
// the path every ordinary post takes for a case only an admin can reach.
//
// Still screened. An admin posting is not a reason to skip moderation — the
// screener is also what catches the wrong photo being uploaded by accident.

interface Body {
  imageUrls?: string[];
  body?: string;
  lat?: number | null;
  lng?: number | null;
  /** Human-readable place, if the client already resolved one. */
  location?: string | null;
  artists?: { id: string; name?: string | null }[];
}

export async function POST(req: Request) {
  const { userId } = await auth();
  // isAdmin() proves it is non-null, but only at runtime — name it so the rest
  // of the handler is a plain string.
  if (!userId || !isAdmin(userId)) {
    return NextResponse.json({ error: "admin_required" }, { status: 403 });
  }
  const adminId: string = userId;

  const limited = rateLimit({ req, name: "admin-artwork", id: adminId, limit: 60, windowMs: 60_000 });
  if (limited) return limited;

  const b = (await req.json().catch(() => ({}))) as Body;
  const imageUrls = (b.imageUrls ?? []).filter((u) => typeof u === "string" && u).slice(0, 10);
  if (!imageUrls.length) {
    return NextResponse.json({ error: "A photo of the artwork is required" }, { status: 400 });
  }

  const artists = (b.artists ?? []).filter((a) => a?.id).slice(0, 20);
  const text = (b.body ?? "").trim().slice(0, 2000);

  const verdict = await screen({ text, imageUrls });
  let heldEventId: string | null = null;
  if (verdict.action !== "allow") {
    heldEventId = await logModerationEvent({
      surface: "post",
      authorId: adminId,
      action: verdict.action,
      categories: verdict.categories,
      scores: verdict.scores,
      text,
      imageCount: imageUrls.length,
      flaggedImages: verdict.flaggedImages,
    });
    if (verdict.action === "block") {
      return NextResponse.json(
        { error: "That image didn't pass the content check, so it wasn't posted.", blocked: true },
        { status: 422 },
      );
    }
  }

  const lat = typeof b.lat === "number" ? b.lat : null;
  const lng = typeof b.lng === "number" ? b.lng : null;

  // Where it is, in words. The coordinates are what the map uses; this is what
  // a person reads on the card. Resolved on the server so a mural photographed
  // from across the street still says the right corner, and best-effort because
  // a missing label is worth far less than a missing post.
  let location = (b.location ?? "").trim() || null;
  if (!location && lat != null && lng != null) {
    location = await reverseGeocode(lat, lng).catch(() => null);
  }

  const u = await currentUser();
  const authorName = u?.fullName || u?.firstName || "WhatsLocal";

  try {
    const post = await createPost(
      {
        author_id: adminId,
        author_name: authorName,
        body: text || null,
        image_urls: imageUrls,
        video_urls: [],
        // The first artist also goes in the legacy column, so every surface
        // that reads a single tag (the feed card, the share composer's idea of
        // a post) shows a credit rather than nothing.
        tagged_member_id: artists[0]?.id ?? null,
        tagged_member_name: artists[0]?.name ?? null,
        tagged_event_id: null,
        tagged_event_title: null,
        livestream_url: null,
        location,
        lat,
        lng,
        moderation_status: verdict.action === "review" ? "pending" : "allowed",
      },
      // ALL of them, including the first — see createPost.
      artists,
    );
    if (heldEventId) void attachModerationContentId(heldEventId, post.id);
    invalidatePosts();
    return NextResponse.json({
      post,
      artists: artists.length,
      pending: verdict.action === "review",
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not post the artwork" },
      { status: 500 },
    );
  }
}
