import type { Member } from "@/lib/types";

// Airbnb-style category groups for the browse directory. Each member is bucketed
// into the first group it matches (by member type + category/tag keywords), so
// the directory reads as rows of "Food & drink", "Artists & makers", etc.
export interface BrowseGroup {
  key: string;
  label: string;
  emoji: string;
  match: (m: Member) => boolean;
}

function haystack(m: Member): string {
  const p = m.profile ?? {};
  const parts: unknown[] = [
    p.category,
    p.subcategory,
    p.memberType,
    p.services,
    p.specialties,
    p.menuHighlights,
    p.interests,
  ];
  const out: string[] = [];
  for (const v of parts) {
    if (typeof v === "string") out.push(v);
    else if (Array.isArray(v)) for (const x of v) if (typeof x === "string") out.push(x);
  }
  return out.join(" ").toLowerCase();
}

const has = (s: string, words: string[]) => words.some((w) => s.includes(w));

export const BROWSE_GROUPS: BrowseGroup[] = [
  {
    key: "food",
    label: "Food & drink",
    emoji: "🍽️",
    match: (m) => has(haystack(m), ["food", "restaurant", "cafe", "coffee", "bakery", "baker", "catering", "bar", "brewery", "kitchen", "eatery", "taco", "grocery", "drink", "dessert", "ice cream", "juice", "snack"]),
  },
  {
    key: "retail",
    label: "Retail & shops",
    emoji: "🛍️",
    match: (m) => has(haystack(m), ["retail", "shop", "store", "boutique", "market", "goods", "apparel", "clothing", "fashion", "thrift", "bookstore", "florist", "flower"]),
  },
  {
    key: "arts",
    label: "Artists & makers",
    emoji: "🎨",
    match: (m) => m.profile?.memberType === "artist" || has(haystack(m), ["art", "artist", "maker", "craft", "handmade", "design", "gallery", "ceramic", "jewelry", "painter", "photograph", "illustrat", "print"]),
  },
  {
    key: "performance",
    label: "Performance & music",
    emoji: "🎭",
    match: (m) => has(haystack(m), ["music", "musician", "band", "dj", "performance", "theater", "theatre", "dance", "comedy", "film", "studio", "venue", "concert"]),
  },
  {
    key: "community",
    label: "Community & orgs",
    emoji: "🤝",
    match: (m) => m.profile?.memberType === "organizer" || has(haystack(m), ["community", "nonprofit", "non-profit", "mutual aid", "center", "org", "church", "library", "school", "civic", "volunteer", "shelter", "food bank"]),
  },
  {
    key: "wellness",
    label: "Health & wellness",
    emoji: "🌿",
    match: (m) => has(haystack(m), ["wellness", "health", "fitness", "yoga", "gym", "spa", "beauty", "salon", "barber", "therapy", "clinic", "medical", "massage"]),
  },
  {
    key: "services",
    label: "Services",
    emoji: "🔧",
    match: (m) => has(haystack(m), ["service", "repair", "cleaning", "plumb", "electric", "construction", "contractor", "legal", "account", "consult", "auto", "mechanic", "moving", "landscap"]),
  },
];

const OTHER: BrowseGroup = { key: "other", label: "More local", emoji: "✨", match: () => false };

// Bucket members into their groups, preserving input order within each group and
// dropping empty groups. Anything unmatched falls into a final "More local" row.
export function groupMembers(members: Member[]): { group: BrowseGroup; members: Member[] }[] {
  const buckets = new Map<string, Member[]>();
  const other: Member[] = [];
  for (const m of members) {
    const g = BROWSE_GROUPS.find((grp) => grp.match(m));
    if (g) {
      const arr = buckets.get(g.key) ?? [];
      arr.push(m);
      buckets.set(g.key, arr);
    } else {
      other.push(m);
    }
  }
  const out = BROWSE_GROUPS.filter((g) => buckets.has(g.key)).map((g) => ({ group: g, members: buckets.get(g.key)! }));
  if (other.length) out.push({ group: OTHER, members: other });
  return out;
}
