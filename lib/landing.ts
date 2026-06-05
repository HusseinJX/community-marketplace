import type { Member } from "./types";
import { listMembers } from "./api";
import { TAXONOMY } from "./taxonomy";
import { isIndexable, lastActiveMs, memberType } from "./seo";

// URL-safe slug: "Food & Beverage" → "food-beverage", "San Francisco" → "san-francisco".
export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip combining diacritical marks
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Walk the connector with the same timestamp-cursor pagination the browse page
// uses, de-duping by id. Capped so a runaway dataset can't stall a render.
export async function fetchAllMembers(cap = 1000): Promise<Member[]> {
  const out: Member[] = [];
  const seen = new Set<string>();
  let cursor: string | undefined;

  for (let page = 0; page < 50 && out.length < cap; page++) {
    let batch: Member[];
    try {
      batch = (await listMembers({ limit: 100, cursor })).members;
    } catch {
      break;
    }
    if (!batch.length) break;

    let oldest = 0;
    let added = 0;
    for (const m of batch) {
      const ms = lastActiveMs(m);
      if (ms && (oldest === 0 || ms < oldest)) oldest = ms;
      if (seen.has(m.id)) continue;
      seen.add(m.id);
      out.push(m);
      added++;
    }
    if (batch.length < 100 || added === 0 || !oldest) break;
    cursor = String(oldest);
  }
  return out;
}

// ---- Categories (static, from the taxonomy) ----

export type CategoryEntry = { name: string; slug: string };

// Distinct top-level business categories across all member types, by slug.
export const CATEGORIES: CategoryEntry[] = (() => {
  const bySlug = new Map<string, CategoryEntry>();
  for (const type of Object.keys(TAXONOMY)) {
    for (const cat of Object.keys(TAXONOMY[type])) {
      const slug = slugify(cat);
      if (!bySlug.has(slug)) bySlug.set(slug, { name: cat, slug });
    }
  }
  return [...bySlug.values()].sort((a, b) => a.name.localeCompare(b.name));
})();

export function categoryFromSlug(slug: string): CategoryEntry | undefined {
  return CATEGORIES.find((c) => c.slug === slug);
}

function memberCategory(m: Member): string | undefined {
  const p = m.profile ?? {};
  return (p.category || p.businessCategory) as string | undefined;
}

// Indexable members whose top-level category matches the given slug.
export function membersInCategory(members: Member[], slug: string): Member[] {
  return members.filter((m) => {
    if (!isIndexable(m)) return false;
    const cat = memberCategory(m);
    return cat ? slugify(cat) === slug : false;
  });
}

// ---- Cities (derived from data) ----

export type CityEntry = { name: string; slug: string; count: number };

// Distinct cities among indexable members. Cities with a single listing are
// dropped — a one-business "city page" is thin content that dilutes the index.
export function citiesFrom(members: Member[]): CityEntry[] {
  const bySlug = new Map<string, CityEntry>();
  for (const m of members) {
    if (!isIndexable(m)) continue;
    const city = m.profile?.city;
    if (!city || typeof city !== "string") continue;
    const slug = slugify(city);
    if (!slug) continue;
    const cur = bySlug.get(slug) ?? { name: city.trim(), slug, count: 0 };
    cur.count++;
    bySlug.set(slug, cur);
  }
  return [...bySlug.values()]
    .filter((c) => c.count >= 2)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export function membersInCity(members: Member[], slug: string): Member[] {
  return members.filter((m) => {
    if (!isIndexable(m)) return false;
    const city = m.profile?.city;
    return typeof city === "string" && slugify(city) === slug;
  });
}

// Human label for a member's type, for landing-page copy.
export function typeLabel(m: Member): string {
  const t = memberType(m);
  return t === "vendor"
    ? "business"
    : t === "artist"
    ? "artist"
    : t === "organizer"
    ? "organizer"
    : "member";
}
