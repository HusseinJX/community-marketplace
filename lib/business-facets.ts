import type { MemberProfile } from "./types";

// Canonical business facets — captured at onboarding, shown on profiles, and
// filterable. These describe the business itself (not an organizer's private
// grouping, which is `member_tags`).

export const BUSINESS_SIZES = [
  { key: "solo", label: "Solo / 1 person" },
  { key: "small", label: "Small (2–10)" },
  { key: "medium", label: "Medium (11–50)" },
  { key: "large", label: "Large (50+)" },
] as const;
export type BusinessSize = (typeof BUSINESS_SIZES)[number]["key"];

export const OWNERSHIP_TAGS = [
  { key: "local-owner", label: "Locally owned" },
  { key: "independent", label: "Independent" },
  { key: "just-started", label: "Just started" },
  { key: "long-time", label: "Long-established" },
  { key: "multiple-locations", label: "Multiple locations" },
  { key: "multiple-businesses", label: "Multiple businesses" },
  { key: "family-owned", label: "Family-owned" },
  { key: "franchise", label: "Franchise" },
  { key: "corporate", label: "Corporate" },
] as const;
export type OwnershipTag = (typeof OWNERSHIP_TAGS)[number]["key"];

export function sizeLabel(key?: string | null): string {
  return BUSINESS_SIZES.find((s) => s.key === key)?.label ?? "";
}
export function ownershipLabel(key: string): string {
  return OWNERSHIP_TAGS.find((o) => o.key === key)?.label ?? key;
}

export function readOwnership(profile?: MemberProfile | null): string[] {
  const raw = profile?.ownershipTags;
  return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string") : [];
}

// A member matches when its size equals the selected size (if any) AND it carries
// every selected ownership tag (AND semantics for precise curation).
export function matchesFacets(
  profile: MemberProfile | undefined | null,
  filter: { size?: string | null; ownership?: string[] }
): boolean {
  if (filter.size && profile?.businessSize !== filter.size) return false;
  if (filter.ownership && filter.ownership.length) {
    const have = new Set(readOwnership(profile));
    if (!filter.ownership.every((t) => have.has(t))) return false;
  }
  return true;
}
