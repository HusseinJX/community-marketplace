import { NextResponse } from "next/server";
import { listMembers } from "@/lib/api";
import { fetchAllMembers } from "@/lib/landing";
import type { Member } from "@/lib/types";
import { slimMember as slim } from "@/lib/member-slim";

// Server-side directory proxy. The home "Who's local" rail and /explore used to
// call listMembers() directly from the browser, which (a) exposed the connector
// to clients and (b) got no benefit from the `next: { revalidate: 300 }` cache
// in lib/api.ts (that hint is ignored in a client fetch). Routing through this
// handler runs the connector call on the server where the fetch cache applies,
// and both surfaces share one key (`/api/directory`) so SWR dedupes them.
//
// Search: the connector's marketplace-members ignores its `search` param and
// marketplace-search is semantic (approximate), so for literal business-name
// keyword search we filter the FULL member set (fetchAllMembers, cached per
// page) by substring across name + business fields. Covers the whole directory,
// not just the first browse page.

// Build one lowercase haystack of the fields worth matching a keyword against.
function haystack(m: Member): string {
  const p = m.profile ?? {};
  return [
    p.name,
    p.businessName,
    p.category,
    p.subcategory,
    p.businessCategory,
    p.businessType,
    p.city,
    p.neighborhood,
    p.businessAddress,
    Array.isArray(p.specialties) ? p.specialties.join(" ") : undefined,
    Array.isArray(p.services) ? p.services.join(" ") : undefined,
  ]
    .filter(Boolean)
    .join(" • ")
    .toLowerCase();
}

// Every whitespace-separated term must appear (AND) — so "mission bakery"
// narrows instead of widening. Name-prefix matches rank first.
function searchMembers(all: Member[], termRaw: string, limit: number): Member[] {
  const terms = termRaw.toLowerCase().split(/\s+/).filter(Boolean);
  const scored: Array<{ m: Member; score: number }> = [];
  for (const m of all) {
    const hay = haystack(m);
    if (!terms.every((t) => hay.includes(t))) continue;
    const name = ((m.profile?.name || m.profile?.businessName || "") as string).toLowerCase();
    // Rank: exact name > name starts-with > name contains > field match only.
    const score = name === termRaw ? 0 : name.startsWith(termRaw) ? 1 : name.includes(termRaw) ? 2 : 3;
    scored.push({ m, score });
  }
  scored.sort((a, b) => a.score - b.score);
  return scored.slice(0, limit).map((s) => s.m);
}

export async function GET(req: Request) {
  const search = new URL(req.url).searchParams.get("search")?.trim();
  try {
    // Slimmed on the way OUT, never before matching: `searchMembers` reads
    // description-ish fields (specialties, services, address) that the cards
    // never draw, so trimming first would quietly narrow what is findable.
    if (search) {
      const all = await fetchAllMembers();
      return NextResponse.json({ members: searchMembers(all, search, 60).map(slim) });
    }
    const { members } = await listMembers({ limit: 100 });
    return NextResponse.json({ members: (members ?? []).map(slim) });
  } catch {
    // Connector down / slow — return empty so callers keep their prior/demo data.
    return NextResponse.json({ members: [] });
  }
}
