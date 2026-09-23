import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { isAdmin } from "@/lib/admin";
import { rateLimit } from "@/lib/rate-limit";
import { searchTags, upsertTag, tagMember, untagMember, type TagKind } from "@/lib/tags";

export const runtime = "nodejs";

// Tags are PUBLIC to read — a shopper opens "Ferry Plaza Farmers Market" and
// expects to see who trades there — and admin-only to write. Same split as the
// canvass tool, for the same reason: a tag is a page with other people's
// businesses on it.

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q") ?? "";
  try {
    return NextResponse.json({ tags: await searchTags(q, 10) });
  } catch {
    return NextResponse.json({ tags: [] });
  }
}

interface Body {
  /** Create-or-find a tag by name. */
  label?: string;
  kind?: TagKind;
  startsAt?: string | null;
  endsAt?: string | null;
  lat?: number | null;
  lng?: number | null;
  /** Attach it to a member in the same call — the canvassing path. */
  memberId?: string;
  memberName?: string | null;
  recurrence?: string | null;
  role?: string | null;
  /** An existing tag, when the picker already resolved one. */
  tagId?: string;
  /** Remove instead of add. */
  remove?: boolean;
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId || !isAdmin(userId)) {
    return NextResponse.json({ error: "admin_required" }, { status: 403 });
  }

  const limited = rateLimit({ req, name: "tags-write", id: userId, limit: 60, windowMs: 60_000 });
  if (limited) return limited;

  const b = (await req.json().catch(() => ({}))) as Body;

  if (b.remove && b.tagId && b.memberId) {
    await untagMember(b.memberId, b.tagId);
    return NextResponse.json({ removed: true });
  }

  try {
    // Either the picker handed us a tag, or the operator typed a new name.
    let tagId = b.tagId;
    let tag = null as Awaited<ReturnType<typeof upsertTag>> | null;
    if (!tagId) {
      if (!b.label?.trim()) return NextResponse.json({ error: "label required" }, { status: 400 });
      tag = await upsertTag({
        label: b.label,
        kind: b.kind,
        startsAt: b.startsAt ?? null,
        endsAt: b.endsAt ?? null,
        lat: b.lat ?? null,
        lng: b.lng ?? null,
        createdBy: userId,
      });
      tagId = tag.id;
    }

    if (b.memberId) {
      await tagMember(b.memberId, b.memberName ?? null, tagId, {
        recurrence: b.recurrence ?? null,
        role: b.role ?? null,
      });
    }

    return NextResponse.json({ tagId, tag, tagged: !!b.memberId });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 },
    );
  }
}
