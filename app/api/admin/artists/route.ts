import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createMember, researchListing, searchMatches } from "@/lib/api";
import { isAdmin } from "@/lib/admin";
import { rateLimit } from "@/lib/rate-limit";
import type { MemberProfile } from "@/lib/types";

export const runtime = "nodejs";

// Artists, for the public-art tool. Super-admin only — same door as creating a
// business from a Maps listing, and for the same reason: these become real,
// public, unclaimed profiles that show up in the Artists section of browse.

/** GET ?q= — find an artist who might already be here, before making another. */
export async function GET(req: Request) {
  const { userId } = await auth();
  if (!isAdmin(userId)) return NextResponse.json({ error: "admin_required" }, { status: 403 });

  const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ artists: [] });

  try {
    const matches = await searchMatches(q, 8);
    return NextResponse.json({
      artists: matches.map((m) => ({
        id: m.id,
        name: m.name,
        // Shown beside the name so the picker can tell two people apart, and
        // so an obviously-wrong match (a restaurant) is visible as one.
        detail: [m.category, m.neighborhood ?? m.city].filter(Boolean).join(" · "),
      })),
    });
  } catch {
    return NextResponse.json({ artists: [] });
  }
}

interface Body {
  name?: string;
  /** Anything the admin already knows. Optional. */
  notes?: string;
  /** Run the web search and write what it finds into the profile. */
  research?: boolean;
  /** Research only — show me what you found, don't create anything yet. */
  preview?: boolean;
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!isAdmin(userId)) return NextResponse.json({ error: "admin_required" }, { status: 403 });

  const limited = rateLimit({ req, name: "admin-artists", id: userId, limit: 40, windowMs: 60_000 });
  if (limited) return limited;

  const body = (await req.json().catch(() => ({}))) as Body;
  const name = (body.name ?? "").trim().slice(0, 120);
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

  // The research pass. Generous timeout for the same reason as the canvass
  // tool — someone is standing in front of a mural waiting for it.
  let research: string | null = null;
  if (body.research || body.preview) {
    research = await researchListing({ name, city: "San Francisco", kind: "artist" }, { timeoutMs: 25_000 })
      .then((r) => r.research)
      .catch(() => null);
  }

  // Preview: hand back what the web says and create nothing. This is what
  // makes "research before you commit" real rather than a loading spinner.
  if (body.preview) return NextResponse.json({ research, created: false });

  const profile: MemberProfile & { name: string } = {
    name,
    businessName: name,
    memberType: "artist",
    category: "Artist",
    subcategory: "Public art",
    city: "San Francisco",
    businessDescription: body.notes?.trim() || undefined,
    notes: "Created from the public-art tool. Unclaimed.",
  };

  const member = await createMember(profile, { source: "public_art" });
  const memberId = (member as { id: string }).id;

  // The story, written in by the connector's own profiling brain — the same
  // engine the /join interview and the canvass tool use, so an artist page
  // reads like a profile rather than a stub with a name on it.
  if (research) {
    try {
      const { onboardFromMessages } = await import("@/lib/api");
      await onboardFromMessages(
        [
          {
            role: "user",
            content: [
              `This is an artist whose work appears in public around San Francisco.`,
              `Name: ${name}`,
              body.notes?.trim() ? `What we know: ${body.notes.trim()}` : "",
              "",
              "Here is what a web search found about them:",
              research,
              "",
              "Write their artist profile from this. Do not invent anything the research does not support.",
            ]
              .filter(Boolean)
              .join("\n"),
          },
        ],
        { source: "public_art", memberId },
      );
    } catch {
      /* the profile stands on the name; the story can be added later */
    }
  }

  return NextResponse.json({
    id: memberId,
    name,
    created: true,
    storySaved: !!research,
    url: `/members/${memberId}`,
  });
}
