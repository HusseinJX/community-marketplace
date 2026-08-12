import type { Member } from "@/lib/types";

// What a member CARD needs, and nothing else.
//
// A connector member carries its full profile: `approvedBlurb`, `personalNote`,
// `businessDescription` and `vibe` are the four fattest fields on it and are
// rendered by no card anywhere. They were 62% of the directory response, and
// the same weight again inside the event page's nearby rail — where every
// member object is serialised into the RSC payload, ~4.9KB per card.
//
// The prose is not lost; it is fetched in full by `getMember` on the profile
// page, which is the only screen that shows it.
//
// This list is a CONTRACT with the surfaces below. Adding a field to a card
// means adding it here too, or it arrives `undefined` — which fails silently,
// so it is worth knowing who reads this:
//   renderers: components/MemberCard.tsx, components/home/LocalDirectory.tsx,
//              app/explore/page.tsx, components/events/NearbyBusinesses.tsx
//   helpers:   lib/browse-groups.ts (category rails), lib/proximity.ts
//              (lat/lng), lib/business-facets.ts (size/ownership filters)
export const CARD_FIELDS = [
  // Identity + card face
  "name", "businessName", "memberType", "images", "imageUrl",
  // Where — the card line, proximity ranking, and "Near me"
  "city", "neighborhood", "businessAddress", "latitude", "longitude",
  // Category rails and grouping
  "category", "subcategory", "businessCategory", "businessType",
  "specialties", "services", "interests", "menuHighlights",
  // The filter sidebar
  "businessSize", "ownershipTags",
] as const;

/**
 * Drop everything a card will never draw.
 *
 * Only ever applied on the way OUT, after any searching or filtering — several
 * of the dropped fields are matched against by name search, so trimming before
 * a match would quietly narrow what is findable.
 */
export function slimMember(m: Member): Member {
  const p = (m.profile ?? {}) as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of CARD_FIELDS) {
    if (p[k] !== undefined) out[k] = p[k];
  }
  return { ...m, profile: out as Member["profile"] };
}
