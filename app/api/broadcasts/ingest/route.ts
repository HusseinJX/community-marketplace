import { NextResponse } from "next/server";
import { createBroadcast } from "@/lib/broadcasts";
import { parseBroadcastText } from "@/lib/parse-broadcast";
import { getMember } from "@/lib/api";
import { eventLabel } from "@/lib/live-events";

export const runtime = "nodejs";

// Server-to-server ingest for the Community Connector Agent. The connector
// forwards a venue's message (SMS / scraped post / agent action) and this
// endpoint AI-parses it into a broadcast. Trust = the shared CONNECTOR_ADMIN_TOKEN
// bearer (same secret this app uses to call the connector). No Clerk.
//
// Body: {
//   memberId: string,            // which venue (required)
//   text?: string,               // raw venue message → AI-parsed
//   source?: string,             // 'sms' | 'connector' | 'scrape' (default 'connector')
//   // optional structured overrides (win over the parse):
//   event_slug?, whats_on?, supports_team?, note?,
//   duration_minutes?, starts_at?, ends_at?, image_urls?, livestream_url?
// }
export async function POST(req: Request) {
  const adminToken = process.env.CONNECTOR_ADMIN_TOKEN;
  if (!adminToken) {
    return NextResponse.json({ error: "CONNECTOR_ADMIN_TOKEN not configured" }, { status: 500 });
  }
  const auth = req.headers.get("authorization") || "";
  if (auth !== `Bearer ${adminToken}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const memberId = String(body.memberId ?? "");
  if (!memberId) return NextResponse.json({ error: "Missing memberId" }, { status: 400 });

  // AI-parse the free text (if provided); structured overrides win.
  let parsed = null;
  if (body.text) {
    parsed = await parseBroadcastText(String(body.text));
  }

  const eventSlug = body.event_slug ?? parsed?.event_slug;
  if (!eventSlug) {
    return NextResponse.json({ error: "Could not determine event (send text or event_slug)" }, { status: 422 });
  }

  // Window: starts now unless a future start is given; ends = explicit or start + duration.
  const startsAt = body.starts_at
    ? new Date(body.starts_at)
    : parsed?.starts_at
    ? new Date(parsed.starts_at)
    : new Date();
  let endsAt: string;
  if (body.ends_at) {
    endsAt = new Date(body.ends_at).toISOString();
  } else {
    const mins = Math.min(Math.max(Number(body.duration_minutes ?? parsed?.duration_minutes) || 180, 15), 720);
    endsAt = new Date(startsAt.getTime() + mins * 60_000).toISOString();
  }

  // Denormalize venue name + location from the member profile.
  let memberName = String(body.memberName ?? "Venue");
  let latitude: number | null = null;
  let longitude: number | null = null;
  let neighborhood: string | null = null;
  let city: string | null = null;
  try {
    const { member } = await getMember(memberId);
    const p = member?.profile;
    if (p) {
      memberName = (p.name as string) || (p.businessName as string) || memberName;
      latitude = typeof p.latitude === "number" ? p.latitude : null;
      longitude = typeof p.longitude === "number" ? p.longitude : null;
      neighborhood = (p.neighborhood as string) || null;
      city = (p.city as string) || null;
    }
  } catch {
    // Non-fatal — broadcast still works without coordinates.
  }

  const created = await createBroadcast(memberId, memberName, {
    event_slug: String(eventSlug),
    event_label: eventLabel(eventSlug),
    whats_on: body.whats_on ?? parsed?.whats_on ?? null,
    note: body.note ?? parsed?.note ?? null,
    supports_team: body.supports_team ?? parsed?.supports_team ?? null,
    image_urls: Array.isArray(body.image_urls) ? body.image_urls : [],
    livestream_url: body.livestream_url ?? null,
    starts_at: startsAt.toISOString(),
    ends_at: endsAt,
    latitude,
    longitude,
    neighborhood,
    city,
    source: body.source ?? "connector",
  });

  return NextResponse.json({ broadcast: created });
}
