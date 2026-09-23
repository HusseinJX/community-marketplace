import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { researchListing, searchMatches } from "@/lib/api";
import { placeDetails } from "@/lib/places";
import { isJoinDemoActive } from "@/lib/joindemo";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

// The review step of the live canvass tool (/joindemo/live): everything we can
// learn about a business BEFORE anything is written.
//
// Read-only on our side — no member is created here, deliberately. The whole
// point of the screen this feeds is that a person sees the Maps facts and the
// researched story, and only then decides. Creating on lookup would make the
// decision meaningless.
//
// Gated like the other demo-billable routes: signed in, OR inside an unlocked
// /joindemo session. The WRITE half (/api/joindemo/create) is admin-only —
// looking costs a Places call, creating puts a row in the public directory.
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId && !(await isJoinDemoActive())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = rateLimit({
    req,
    name: "joindemo-lookup",
    id: userId ?? "demo",
    limit: 20,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const { placeId } = (await req.json().catch(() => ({}))) as { placeId?: string };
  if (!placeId) return NextResponse.json({ error: "placeId required" }, { status: 400 });

  const details = await placeDetails(placeId);
  if (!details) return NextResponse.json({ error: "place_not_found" }, { status: 404 });

  // Research and the duplicate check are independent, and the research is the
  // slow one (a web search, time-boxed on the connector). Run them together so
  // the reviewer waits for the slower, not the sum — this is happening in front
  // of an audience.
  const [research, duplicate] = await Promise.all([
    researchListing(
      {
        name: details.name,
        city: details.city ?? details.neighborhood ?? null,
      },
      // Generous on purpose — see researchListing. A cold connector takes 7s+
      // and the default 11s lost the story in testing, which on this screen
      // reads as "the product doesn't work" to whoever is watching.
      { timeoutMs: 25_000 },
    )
      .then((r) => ({ research: r.research, failed: false }))
      // Best-effort: the story is the nice half, the Maps facts are the real
      // half. A dead connector must not block creating the profile — but say
      // that it FAILED rather than that there is nothing to tell, so the
      // operator knows to press retry instead of shrugging.
      .catch(() => ({ research: null, failed: true })),
    searchMatches(`${details.name} ${details.city ?? ""}`.trim(), 3)
      .then((matches) => {
        // Only a close name match is worth a warning. "Cafe" matching forty
        // cafes would train the operator to ignore the banner entirely.
        const want = details.name.trim().toLowerCase();
        return (
          matches.find((m) => {
            const got = (m.name ?? "").trim().toLowerCase();
            return got === want || got.includes(want) || want.includes(got);
          }) ?? null
        );
      })
      .catch(() => null),
  ]);

  return NextResponse.json({
    details,
    research: research.research,
    researchFailed: research.failed,
    duplicate: duplicate ? { id: duplicate.id, name: duplicate.name } : null,
  });
}
