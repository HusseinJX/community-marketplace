import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { isAdmin } from "@/lib/admin";
import {
  getFeaturedLists,
  createFeaturedList,
  updateFeaturedList,
  deleteFeaturedList,
} from "@/lib/featured";
import { getLiveBroadcasts, getSaveCounts, getSavedBroadcastIds } from "@/lib/broadcasts";
import { getMember } from "@/lib/api";

// GET
//  ?admin=1  → admin only: raw lists incl. inactive, for the manager UI.
//  default   → public: active lists enriched with live broadcasts + pinned venues.
export async function GET(req: Request) {
  const adminView = new URL(req.url).searchParams.get("admin") === "1";
  const { userId } = await auth();

  if (adminView) {
    if (!isAdmin(userId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ lists: await getFeaturedLists(true) });
  }

  const lists = await getFeaturedLists(false);

  // Live broadcasts per list (deduped query per list — small N).
  const enriched = await Promise.all(
    lists.map(async (l) => {
      const broadcasts = l.event_slug
        ? await getLiveBroadcasts(l.event_slug, l.supports_team)
        : [];
      const liveMemberIds = new Set(broadcasts.map((b) => b.member_id));

      // Pinned venues that aren't already represented by a live broadcast.
      const pinnedIds = (l.member_ids || []).filter((id) => !liveMemberIds.has(id)).slice(0, 12);
      const venues = (
        await Promise.all(
          pinnedIds.map(async (id) => {
            try {
              const { member } = await getMember(id);
              const p = member?.profile;
              if (!p) return null;
              return {
                member_id: id,
                name: (p.name as string) || (p.businessName as string) || "Venue",
                neighborhood: (p.neighborhood as string) || null,
                city: (p.city as string) || null,
              };
            } catch {
              return null;
            }
          })
        )
      ).filter(Boolean);

      return { list: l, broadcasts, venues };
    })
  );

  // Annotate broadcasts with save counts + the current user's saved state.
  const allIds = enriched.flatMap((e) => e.broadcasts.map((b) => b.id));
  const counts = await getSaveCounts(allIds);
  const savedSet = userId ? new Set(await getSavedBroadcastIds(userId)) : new Set<string>();

  const result = enriched
    .map((e) => ({
      ...e.list,
      broadcasts: e.broadcasts.map((b) => ({
        ...b,
        save_count: counts[b.id] ?? 0,
        saved: savedSet.has(b.id),
      })),
      venues: e.venues,
    }))
    // Drop empty rails so the home screen never shows a "where to watch" with nothing in it.
    .filter((e) => e.broadcasts.length > 0 || e.venues.length > 0);

  return NextResponse.json({ lists: result });
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!isAdmin(userId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  if (!body?.title) return NextResponse.json({ error: "Missing title" }, { status: 400 });
  const created = await createFeaturedList({
    title: String(body.title),
    subtitle: body.subtitle ?? null,
    event_slug: body.event_slug ?? null,
    supports_team: body.supports_team ?? null,
    member_ids: Array.isArray(body.member_ids) ? body.member_ids : [],
    sort_order: Number(body.sort_order) || 0,
    active: body.active ?? true,
  });
  return NextResponse.json({ list: created });
}

export async function PATCH(req: Request) {
  const { userId } = await auth();
  if (!isAdmin(userId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  if (!body?.id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const fields: Record<string, unknown> = {};
  for (const k of ["title", "subtitle", "event_slug", "supports_team", "member_ids", "sort_order", "active"] as const) {
    if (k in body) fields[k] = body[k];
  }
  await updateFeaturedList(String(body.id), fields);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const { userId } = await auth();
  if (!isAdmin(userId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await req.json().catch(() => ({ id: "" }));
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  await deleteFeaturedList(String(id));
  return NextResponse.json({ ok: true });
}
