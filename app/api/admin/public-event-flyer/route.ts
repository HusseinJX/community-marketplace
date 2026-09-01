import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { isAdmin } from "@/lib/admin";
import { hostIdFor } from "@/lib/sources/persist";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SOURCE_ID = "community_flyer";
const SOURCE_LABEL = "Community flyer";

function db() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL and a Supabase key are required");
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!isAdmin(userId)) return NextResponse.json({ error: "Not allowed" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const items = Array.isArray(body.events) ? body.events : [];
  const events = items
    .map((event) => ({
      title: typeof event?.title === "string" ? event.title.trim() : "",
      description: typeof event?.description === "string" ? event.description.trim() : null,
      event_date: typeof event?.event_date === "string" ? event.event_date.trim() : null,
      event_time: typeof event?.event_time === "string" ? event.event_time.trim() : null,
      location: typeof event?.location === "string" ? event.location.trim() : null,
      poster_image_url:
        typeof event?.poster_image_url === "string" ? event.poster_image_url.trim() : null,
    }))
    .filter((event) => event.title);

  if (!events.length) {
    return NextResponse.json({ error: "No event drafts to publish" }, { status: 400 });
  }

  const reviewedAt = new Date().toISOString();
  const { data, error } = await db()
    .from("vendor_events")
    .insert(
      events.map((event) => ({
        member_id: hostIdFor(SOURCE_ID),
        member_name: SOURCE_LABEL,
        title: event.title,
        description: event.description || null,
        event_date: event.event_date || null,
        event_time: event.event_time || null,
        location: event.location || null,
        poster_image_url: event.poster_image_url || null,
        source: SOURCE_ID,
        active: true,
        source_id: SOURCE_ID,
        external_uid: `flyer:${randomUUID()}`,
        event_url: null,
        reviewed_at: reviewedAt,
      })),
    )
    .select("id, title");

  if (error) {
    return NextResponse.json({ error: error.message || "Could not publish events" }, { status: 500 });
  }

  return NextResponse.json({ created: data ?? [] });
}
