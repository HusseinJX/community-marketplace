import { NextResponse } from "next/server";
import {
  getBroadcastsByMember,
  createBroadcast,
  updateBroadcast,
  deleteBroadcast,
} from "@/lib/broadcasts";
import { resolveActor } from "@/lib/admin";
import { getMember } from "@/lib/api";
import { eventLabel } from "@/lib/live-events";

// GET — a member's broadcasts. ?include_expired=1 (owner/admin) shows past ones.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ memberId: string }> }
) {
  const { memberId } = await params;
  const includeExpired = new URL(req.url).searchParams.get("include_expired") === "1";

  if (includeExpired) {
    const actor = await resolveActor(memberId);
    if (!actor || actor.memberId !== memberId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    return NextResponse.json(await getBroadcastsByMember(memberId, true));
  }
  return NextResponse.json(await getBroadcastsByMember(memberId, false));
}

// POST — go live. Body: { event_slug, whats_on?, note?, duration_minutes? | ends_at?, event_label? }
export async function POST(
  req: Request,
  { params }: { params: Promise<{ memberId: string }> }
) {
  const { memberId } = await params;
  const actor = await resolveActor(memberId);
  if (!actor || actor.memberId !== memberId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  if (!body?.event_slug) {
    return NextResponse.json({ error: "Missing event_slug" }, { status: 400 });
  }

  // Resolve the window. starts_at may be in the future (a scheduled game);
  // ends_at = explicit, else starts_at + duration.
  const startsAt = body.starts_at ? new Date(body.starts_at) : new Date();
  let endsAt: string;
  if (body.ends_at) {
    endsAt = new Date(body.ends_at).toISOString();
  } else {
    const minutes = Math.min(Math.max(Number(body.duration_minutes) || 180, 15), 720);
    endsAt = new Date(startsAt.getTime() + minutes * 60_000).toISOString();
  }

  // Denormalize venue name + location from the member profile so /live and the
  // map render without re-fetching the connector per card.
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
    // Non-fatal — broadcast still works without map coordinates.
  }

  const created = await createBroadcast(memberId, memberName, {
    event_slug: String(body.event_slug),
    event_label: body.event_label ?? eventLabel(body.event_slug),
    whats_on: body.whats_on ?? null,
    note: body.note ?? null,
    supports_team: body.supports_team ?? null,
    image_urls: Array.isArray(body.image_urls) ? body.image_urls : [],
    livestream_url: body.livestream_url ?? null,
    starts_at: startsAt.toISOString(),
    ends_at: endsAt,
    latitude,
    longitude,
    neighborhood,
    city,
  });

  return NextResponse.json({ broadcast: created });
}

// PATCH — extend / end early / edit. Body: { id, ends_at?, active?, whats_on?, note? }
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ memberId: string }> }
) {
  const { memberId } = await params;
  const actor = await resolveActor(memberId);
  if (!actor || actor.memberId !== memberId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  if (!body.id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const fields: Record<string, unknown> = {};
  for (const k of ["event_slug", "event_label", "whats_on", "note", "supports_team", "image_urls", "livestream_url", "active"] as const) {
    if (k in body) fields[k] = body[k];
  }
  if (body.starts_at) fields.starts_at = new Date(body.starts_at).toISOString();
  if (body.ends_at) fields.ends_at = new Date(body.ends_at).toISOString();

  await updateBroadcast(String(body.id), memberId, fields);
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ memberId: string }> }
) {
  const { memberId } = await params;
  const actor = await resolveActor(memberId);
  if (!actor || actor.memberId !== memberId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  const { id } = await req.json().catch(() => ({ id: "" }));
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  await deleteBroadcast(String(id), memberId);
  return NextResponse.json({ ok: true });
}
