import type { MemberProfile } from "./types";
import { usableImages } from "./image-utils";

export const MEMBER_HERO_IMAGES: Record<string, string[]> = {
  // Real members
  // Xeno — founder, WhatsLocal AI (San Francisco)
  "89516919-256f-4a95-96df-fc9d285f664a": [
    "https://xbbnvkvlrucrzobhopgh.supabase.co/storage/v1/object/public/marketplace-media/profile/89516919-256f-4a95-96df-fc9d285f664a/art-1-6.jpeg",
    "https://xbbnvkvlrucrzobhopgh.supabase.co/storage/v1/object/public/marketplace-media/profile/89516919-256f-4a95-96df-fc9d285f664a/art-2-7.jpeg",
    "https://xbbnvkvlrucrzobhopgh.supabase.co/storage/v1/object/public/marketplace-media/profile/89516919-256f-4a95-96df-fc9d285f664a/art-3-8.jpeg",
    "https://xbbnvkvlrucrzobhopgh.supabase.co/storage/v1/object/public/marketplace-media/profile/89516919-256f-4a95-96df-fc9d285f664a/art-4-9.jpeg",
  ],
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
 *   1) hand-curated MEMBER_HERO_IMAGES (showcased members)
 *   2) imported profile.images[]
 *   3) the single profile.imageUrl fallback
 *
 * All of them pass through `usableImages`, so an untrusted host is the same as
 * no image — which is the point: that is exactly what the card would render.
 * Empty means the card falls back to a coloured gradient.
 */
export function memberImages(member: { id: string; profile?: MemberProfile | null }): string[] {
  const curated = usableImages(MEMBER_HERO_IMAGES[member.id]);
  if (curated.length) return curated;
  const p = member.profile ?? {};
  const imported = Array.isArray(p.images) ? usableImages(p.images as string[]) : [];
  if (imported.length) return imported;
  return usableImages(p.imageUrl ? [p.imageUrl as string] : []);
}

/** True when a card would show a real photo rather than a gradient. */
export function hasMemberImage(member: { id: string; profile?: MemberProfile | null }): boolean {
  return memberImages(member).length > 0;
}
