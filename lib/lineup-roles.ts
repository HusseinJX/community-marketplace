// Roles a member can hold in an event lineup. A festival isn't just vendors —
// it's performers, food trucks, sponsors, volunteers, partners. The role lives
// on the collab_invites.role column (already present); this is the shared vocab.

export interface LineupRoleDef {
  key: string;
  label: string; // singular
  plural: string;
  emoji: string;
}

export const LINEUP_ROLES: LineupRoleDef[] = [
  { key: "vendor", label: "Vendor", plural: "Vendors", emoji: "🛍️" },
  { key: "performer", label: "Performer", plural: "Performers", emoji: "🎤" },
  { key: "food", label: "Food truck", plural: "Food & drink", emoji: "🌮" },
  { key: "sponsor", label: "Sponsor", plural: "Sponsors", emoji: "🤝" },
  { key: "partner", label: "Partner", plural: "Partners", emoji: "⭐" },
  { key: "volunteer", label: "Volunteer", plural: "Volunteers", emoji: "🙌" },
];

const ROLE_ORDER = new Map(LINEUP_ROLES.map((r, i) => [r.key, i]));

// Infer a lineup role from who the member already IS, rather than asking the
// organizer to classify every person they invite. A taquería is food, a muralist
// performs, a community org partners. The organizer can still be wrong about an
// edge case — but they're wrong about it AFTER the invite, not before it.
export function inferRole(m: {
  memberType?: string | null;
  category?: string | null;
  offers?: string[] | null;
}): string {
  const hay = [m.category ?? "", ...(m.offers ?? [])].join(" ").toLowerCase();
  const type = (m.memberType ?? "").toLowerCase();

  if (/food|beverage|coffee|drink|taco|taquer|bakery|bake|kitchen|cafe|café|brew|juice|restaurant/.test(hay)) {
    return "food";
  }
  if (type === "artist" || /music|band|dj|perform|mural|art|design|dance|comedy/.test(hay)) {
    return "performer";
  }
  if (type === "organizer" || /nonprofit|non-profit|community|charity|org\b/.test(hay)) return "partner";
  return "vendor";
}

export function roleDef(key: string | null | undefined): LineupRoleDef {
  return LINEUP_ROLES.find((r) => r.key === key) ?? LINEUP_ROLES[0];
}

export function roleLabel(key: string | null | undefined): string {
  return roleDef(key).label;
}

// Group lineup entries by role, ordered by the vocab (vendor → performer → …).
export function groupByRole<T extends { role: string | null }>(
  items: T[]
): { role: LineupRoleDef; items: T[] }[] {
  const buckets = new Map<string, T[]>();
  for (const it of items) {
    const key = roleDef(it.role).key;
    (buckets.get(key) ?? buckets.set(key, []).get(key)!).push(it);
  }
  return [...buckets.entries()]
    .sort((a, b) => (ROLE_ORDER.get(a[0]) ?? 99) - (ROLE_ORDER.get(b[0]) ?? 99))
    .map(([key, items]) => ({ role: roleDef(key), items }));
}
