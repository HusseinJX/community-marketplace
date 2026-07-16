import { NextResponse } from "next/server";
import { resolveReadActor } from "@/lib/admin";
import { rateLimit } from "@/lib/rate-limit";
import { demoMatches } from "@/lib/demo-match";
import {
  searchMatches,
  similarMembers,
  complementaryFor,
  matchObjective,
  suggestLineup,
} from "@/lib/api";

// Server-side proxy for the connector's ADMIN_TOKEN-gated matching engine.
// Keeps CONNECTOR_ADMIN_TOKEN off the client. All modes are read-only discovery,
// so demo actors are allowed through (they seed off a representative member).
//
// POST body: { mode, memberId?, ...modeArgs }
//   semantic      { query }            → NL search (public engine, normalized)
//   complementary { }                  → "for you", seeded by the acting member
//   similar       { targetId? }        → members like targetId (default: self)
//   objective     { objective }        → need/theme text → people who offer it
//   lineup        { hint }             → invent-event → per-role candidate fills
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  // Read-only discovery → cookie-based demo visitors are allowed through.
  const actor = await resolveReadActor(body.memberId);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const mode = String(body.mode ?? "");
  const limit = Math.min(Number(body.limit) || 8, 24);

  // The demo entry is a self-serve cookie, so it must NOT reach the paid engine
  // (OpenAI embed + Pinecone query + a Firestore read per hydrated result).
  // Canned candidates instead — which also keeps the demo alive when the
  // connector is down.
  if (actor.isDemo) {
    if (mode === "lineup") return NextResponse.json({ suggestion: null, demo: true });
    return NextResponse.json({
      candidates: demoMatches(mode === "semantic" ? String(body.query ?? "") : undefined, limit),
      demo: true,
    });
  }

  // Every real call costs money and Firestore reads. Cap per member and per IP.
  const limited = rateLimit({
    req,
    name: "match",
    id: actor.memberId,
    limit: 30,
    windowMs: 60_000,
    ipLimit: 60,
  });
  if (limited) return limited;

  try {
    switch (mode) {
      case "semantic": {
        const query = String(body.query ?? "").trim();
        if (!query) return NextResponse.json({ candidates: [] });
        return NextResponse.json({ candidates: await searchMatches(query, limit) });
      }
      case "complementary":
        return NextResponse.json({ candidates: await complementaryFor(actor.memberId, limit) });
      case "similar": {
        const targetId = String(body.targetId ?? actor.memberId);
        return NextResponse.json({ candidates: await similarMembers(targetId, limit) });
      }
      case "objective": {
        const objective = String(body.objective ?? "").trim();
        if (!objective) return NextResponse.json({ candidates: [] });
        return NextResponse.json({ candidates: await matchObjective(objective, limit) });
      }
      case "lineup": {
        const hint = String(body.hint ?? "").trim();
        if (!hint) return NextResponse.json({ error: "Describe the event" }, { status: 400 });
        return NextResponse.json({ suggestion: await suggestLineup(hint) });
      }
      default:
        return NextResponse.json({ error: `Unknown mode: ${mode}` }, { status: 400 });
    }
  } catch (err) {
    // The connector matching engine can time out (Firestore quota). Fail soft so
    // the UI can show an empty/"try again" state rather than a hard error.
    const message = err instanceof Error ? err.message : "Matching failed";
    return NextResponse.json({ error: message, candidates: [] }, { status: 502 });
  }
}
