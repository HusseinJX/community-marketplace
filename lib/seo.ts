import type { Member, MemberProfile } from "./types";
import { MEMBER_HERO_IMAGES } from "./member-images";
import { usableImages, isPlaceholder } from "./image-utils";

// Canonical origin for absolute URLs (canonical tags, sitemap, JSON-LD @id).
// Trailing slash stripped so `${SITE_URL}/path` never double-slashes.
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://whatslocal.ai"
).replace(/\/$/, "");

export const SITE_NAME = "WhatsLocal AI";

// Real-entity member types worth surfacing to search engines + AI crawlers.
// Shoppers and influencers are people, not indexable businesses.
const INDEXABLE_TYPES = new Set(["vendor", "artist", "organizer"]);

export function memberType(member: Member): string {
  return (member.profile?.memberType as string | undefined)?.toLowerCase() ?? "";
}

// Does this profile carry enough real content to deserve a place in the index?
// A name plus any substantive field (business info, bio, location, catalog).
// Guards against thin/empty pages diluting domain authority.
function hasSubstance(p: MemberProfile): boolean {
  const arr = (v: unknown) => Array.isArray(v) && v.length > 0;
  return Boolean(
    p.name &&
      (p.businessName ||
        p.businessDescription ||
        p.businessAddress ||
        p.businessCategory ||
        p.approvedBlurb ||
        p.personalNote ||
        p.notes ||
        (typeof p.latitude === "number" && typeof p.longitude === "number") ||
        arr(p.services) ||
        arr(p.specialties) ||
        arr(p.products) ||
        arr(p.menuHighlights))
  );
}

// Index real businesses/artists/organizers with substance — including unclaimed
// harvested listings (the long-tail directory model: a real business is worth
// indexing whether or not its owner has claimed it). Skip people-type profiles
// and content-thin pages.
export function isIndexable(member: Member): boolean {
  if (!INDEXABLE_TYPES.has(memberType(member))) return false;
  return hasSubstance(member.profile ?? {});
}

function truncate(s: string, max: number): string {
  const clean = s.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return clean.slice(0, max - 1).replace(/\s+\S*$/, "").trim() + "…";
}

// SERP-friendly description: real bio if present, otherwise a synthesized
// one-liner from type + category + location so the page is never blank.
export function memberDescription(member: Member, max = 155): string {
  const p = member.profile ?? {};
  const notesStr = Array.isArray(p.notes)
    ? (p.notes as string[]).join(" · ")
    : (p.notes as string | undefined);
  const bio =
    (p.approvedBlurb as string) ||
    (p.businessDescription as string) ||
    (p.personalNote as string) ||
    notesStr ||
    "";
  if (bio) return truncate(bio, max);

  const name = (p.name as string) || "Local member";
  const type = memberType(member);
  const noun =
    type === "vendor"
      ? "Local business"
      : type === "artist"
      ? "Local artist"
      : type === "organizer"
      ? "Community organizer"
      : "Community member";
  const cat = (p.category || p.businessCategory) as string | undefined;
  const loc = [p.neighborhood, p.city].filter(Boolean).join(", ");
  const parts = [
    `${noun}${cat ? ` — ${cat}` : ""}`,
    loc && `in ${loc}`,
    `on ${SITE_NAME}.`,
  ].filter(Boolean);
  return truncate(`${name}. ${parts.join(" ")}`, max);
}

// All known social/profile links for the member, as absolute URLs.
// Used as schema.org `sameAs` to tie the profile to its real-world identity.
export function socialUrls(p: MemberProfile): string[] {
  const urls: string[] = [];
  const push = (u?: string) => {
    if (!u) return;
    urls.push(u.startsWith("http") ? u : `https://${u}`);
  };
  if (p.instagramHandle) push(`https://instagram.com/${p.instagramHandle}`);
  if (p.tiktokHandle) push(`https://tiktok.com/@${p.tiktokHandle}`);
  if (p.twitterHandle || p.xHandle)
    push(`https://x.com/${p.twitterHandle || p.xHandle}`);
  if (p.threadsHandle) push(`https://threads.net/@${p.threadsHandle}`);
  if (p.youtubeUrl) push(p.youtubeUrl as string);
  else if (p.youtubeHandle) push(`https://youtube.com/@${p.youtubeHandle}`);
  push(p.linkedinUrl as string);
  push(p.spotifyUrl as string);
  push(p.soundcloudUrl as string);
  push(p.facebookUrl as string);
  push(p.eventbriteUrl as string);
  push(p.bandsintownUrl as string);
  push(p.songkickUrl as string);
  push(p.meetupUrl as string);
  push(p.pinterestUrl as string);
  push(p.websiteUrl as string);
  return Array.from(new Set(urls));
}

// Hero/profile images for a member — same precedence as the profile page:
// curated overrides → API gallery → single imageUrl. Returns absolute URLs
// (the source data is already absolute) for OG tags and JSON-LD `image`.
export function resolveHeroImages(id: string, p: MemberProfile): string[] {
  const curated = MEMBER_HERO_IMAGES[id];
  if (curated && curated.length) return curated;
  const gallery = Array.isArray(p.images) ? usableImages(p.images as string[]) : [];
  if (gallery.length) return gallery;
  const single =
    typeof p.imageUrl === "string" && !isPlaceholder(p.imageUrl)
      ? [p.imageUrl as string]
      : [];
  return single;
}

// Milliseconds since epoch for a member's last activity, or 0 if unknown.
// Mirrors the timestamp-cursor pagination used by the browse page.
export function lastActiveMs(member: Member): number {
  const t = member.lastActiveAt;
  if (!t) return 0;
  if (typeof t === "string") {
    const ms = Date.parse(t);
    return Number.isNaN(ms) ? 0 : ms;
  }
  if (typeof t === "object" && "_seconds" in t) return t._seconds * 1000;
  return 0;
}
