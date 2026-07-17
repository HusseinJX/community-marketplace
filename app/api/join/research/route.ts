import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { researchMember, researchListing } from "@/lib/api";
import { buildInterviewBrief, type BriefInput } from "@/lib/onboard";
import { isDemoMode } from "@/lib/demo-admin";
import { isJoinDemoActive } from "@/lib/joindemo";

export const runtime = "nodejs";

// ── DEV research checkpoint ──────────────────────────────────────────────────
// Every reload of the interview buys a fresh Perplexity pass (the connector call
// below is `no-store`), which while iterating on the PROMPT means paying, and
// waiting ~5s, for an answer we already have. This caches the paid pass on disk
// so repeat runs of the same business are instant and free.
//
// It caches the RESEARCH TEXT, not the finished brief — deliberately. Caching
// the brief would freeze buildInterviewBrief()'s output too, so prompt edits
// would silently have no effect and we'd be debugging a ghost. The expensive
// part is cached; the assembly stays live.
//
// Dev only, and never in production. Bust it by deleting the directory printed
// on write, or set JOIN_RESEARCH_CACHE=0 to skip it for one run.
const CACHE_ON =
  process.env.NODE_ENV !== "production" &&
  process.env.JOIN_RESEARCH_CACHE !== "0";
const CACHE_DIR = join(tmpdir(), "whatslocal-join-research");

interface CachedResearch {
  research: string | null;
  enriched: Partial<BriefInput>;
}

// Keyed by what the search actually varies on: who, and where.
function cacheKey(seed: BriefInput, memberId: string): string {
  const id = seed.name
    ? `${seed.name}|${seed.city ?? seed.neighborhood ?? ""}`
    : memberId;
  return createHash("sha1").update(id.toLowerCase()).digest("hex").slice(0, 16);
}

async function readCache(key: string): Promise<CachedResearch | null> {
  if (!CACHE_ON) return null;
  try {
    return JSON.parse(
      await readFile(join(CACHE_DIR, `${key}.json`), "utf8"),
    ) as CachedResearch;
  } catch {
    return null; // no checkpoint yet
  }
}

async function writeCache(key: string, v: CachedResearch): Promise<void> {
  if (!CACHE_ON || !v.research) return; // never checkpoint an empty pass
  try {
    await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(join(CACHE_DIR, `${key}.json`), JSON.stringify(v), "utf8");
    console.log(
      `[join/research] checkpoint saved → ${join(CACHE_DIR, `${key}.json`)}`,
    );
  } catch {
    // A cache that can't write is not an error worth failing the interview over.
  }
}

// POST { memberId, seed? } — build a "what we already know" brief to WARM the
// /join onboarding interview so the agent opens already knowing the business.
// `seed` is the instant, zero-latency baseline the client already has (from the
// Google Places pick); we merge a best-effort connector web-search research pass
// on top when it returns in time. Always resolves with a usable brief — a slow
// or failed research pass just falls back to the seed. Never blocks the flow.
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId && !isDemoMode() && !(await isJoinDemoActive())) {
    return NextResponse.json({ error: "Sign in" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const memberId = String(body.memberId ?? "").trim();
  const seed = (body.seed ?? {}) as BriefInput;
  if (!memberId)
    return NextResponse.json({ error: "memberId required" }, { status: 400 });

  let research: string | null = null;
  let enriched: Partial<BriefInput> = {};

  // A saved checkpoint short-circuits the paid pass (dev only).
  const key = cacheKey(seed, memberId);
  const hit = await readCache(key);
  if (hit) {
    console.log("[join/research] checkpoint HIT — skipping Perplexity");
    research = hit.research;
    enriched = hit.enriched;
  }
  if (!hit) {
    // DEMO: the member id is synthetic — nothing was written to the DB, so there's
    // no record for the connector to load. It doesn't need one: the search only
    // uses a name and a city, and the demo has both from the REAL Places pick. So
    // research the listing directly instead of skipping the pass.
    //
    // (This used to `throw` here, which meant /joindemo never web-searched at all
    // and opened the interview knowing nothing but the Places listing — and Places
    // has no editorial summary for most small businesses, so usually just a name.)
    const isDemoMember = memberId.startsWith("demo");
    try {
      if (isDemoMember) {
        const name = (seed.name ?? "").trim();
        if (!name) throw new Error("demo — no listing name to research");
        const r = await researchListing({
          name,
          city: seed.city ?? seed.neighborhood ?? null,
        });
        research = r.research;
      } else {
        const r = await researchMember(memberId);
        research = r.research;
        // The connector may have richer structured fields than the client seed.
        if (r.profile) {
          const p = r.profile as Record<string, unknown>;
          enriched = {
            category: (p.category as string) ?? undefined,
            subcategory: (p.subcategory as string) ?? undefined,
            description: (p.businessDescription as string) ?? undefined,
            products: (p.products as string[]) ?? undefined,
            services: (p.services as string[]) ?? undefined,
          };
        }
      }
    } catch {
      // Best-effort — fall back to whatever the client seeded. A slow or failed
      // research pass must never block the interview from starting.
    }
    await writeCache(key, { research, enriched });
  }

  const brief = buildInterviewBrief({
    ...seed,
    category: seed.category ?? enriched.category ?? null,
    subcategory: seed.subcategory ?? enriched.subcategory ?? null,
    description: seed.description ?? enriched.description ?? null,
    products: seed.products ?? enriched.products ?? null,
    services: seed.services ?? enriched.services ?? null,
    research,
  });

  return NextResponse.json({ brief, hasResearch: Boolean(research) });
}
