import type { MemberProfile } from "./types";
import { usableImages } from "./image-utils";

/**
 * Hand-picked imagery for members whose own profile has none — DEMO members
 * only now.
 *
 * It used to hold real members too, and that is a trap: curated images USED TO
 * WIN over the profile's own, so a vendor who added a photo on /vendor/about
 * would have seen nothing change anywhere. Anything a member can edit must beat
 * anything we hardcoded. Xeno's entry was removed because its profile already
 * carried the identical list.
 */
export const MEMBER_HERO_IMAGES: Record<string, string[]> = {
  // Demo members
  "demo-dani-cruz": [
    "https://images.unsplash.com/photo-1551913902-c92207136625?auto=format&fit=crop&w=1200&q=70",
    "https://images.unsplash.com/photo-1578926375605-eaf7559b1458?auto=format&fit=crop&w=1200&q=70",
    "https://images.unsplash.com/photo-1499781350541-7783f6c6a0c8?auto=format&fit=crop&w=1200&q=70",
  ],
  "demo-kira-wave": [
    "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1200&q=70",
    "https://images.unsplash.com/photo-1442512595331-e89e73853f31?auto=format&fit=crop&w=1200&q=70",
    "https://images.unsplash.com/photo-1559925393-8be0ec4767c8?auto=format&fit=crop&w=1200&q=70",
  ],
  "demo-south-la-mutual-aid": [
    "https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&w=1200&q=70",
    "https://images.unsplash.com/photo-1593113598332-cd288d649433?auto=format&fit=crop&w=1200&q=70",
    "https://images.unsplash.com/photo-1532629345422-7515f3d16bb6?auto=format&fit=crop&w=1200&q=70",
  ],
  "demo-casa-verde": [
    "https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?auto=format&fit=crop&w=1200&q=70",
    "https://images.unsplash.com/photo-1459411552884-841db9b3cc2a?auto=format&fit=crop&w=1200&q=70",
    "https://images.unsplash.com/photo-1485955900006-10f4d324d411?auto=format&fit=crop&w=1200&q=70",
  ],
};

// ── What a member card will actually draw ────────────────────────────────────
// One implementation, two readers: MemberCard renders this list, and the Shops
// directory uses it to decide whether a business is worth a tile at all. Kept
// together because the failure mode of two copies is silent in both directions
// — a directory that hides a business whose photo would have rendered, or one
// that shows a gradient tile it promised was a photo.

/**
 * Every image a card can show for this member, best first:
 *   1) profile.images[] — what the OWNER set on /vendor/about (or an import)
 *   2) the single profile.imageUrl fallback
 *   3) hand-curated MEMBER_HERO_IMAGES, for demo members with no profile of
 *      their own
 *
 * THE OWNER'S LIST WINS. It used to be the other way round, which meant the
 * profile editor could not change what a showcased member's page showed.
 *
 * All of them pass through `usableImages`, so an untrusted host is the same as
 * no image — which is the point: that is exactly what the card would render.
 * Empty means the card falls back to a coloured gradient.
 *
 * ONE implementation, five readers (member page, explore, browse, SEO, cards).
 * Each used to carry its own copy of this precedence.
 */
export function memberImages(member: { id: string; profile?: MemberProfile | null }): string[] {
  const p = member.profile ?? {};
  const own = Array.isArray(p.images) ? usableImages(p.images as string[]) : [];
  if (own.length) return own;
  const single = usableImages(p.imageUrl ? [p.imageUrl as string] : []);
  if (single.length) return single;
  return usableImages(MEMBER_HERO_IMAGES[member.id]);
}

/** True when a card would show a real photo rather than a gradient. */
export function hasMemberImage(member: { id: string; profile?: MemberProfile | null }): boolean {
  return memberImages(member).length > 0;
}
