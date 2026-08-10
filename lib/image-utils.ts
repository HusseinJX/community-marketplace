import { DISPLAYABLE_IMAGE_HOSTS } from "./image-hosts";

const PLACEHOLDER_HINTS = [
  "photo-1441986300917-64674bd600d8", // prolocaliq seed unsplash garbage
];

// Only show images from hosts we control or have deliberately curated —
// everything else falls back to a gradient rather than rendering a third-party
// link we don't control. The list lives in lib/image-hosts.ts because
// next.config.ts needs the same facts; keeping a second copy here is what made
// every scraped event poster invisible. The Unsplash placeholder is still
// caught separately by PLACEHOLDER_HINTS so it can't slip through.
const TRUSTED_IMAGE_HOSTS: readonly string[] = DISPLAYABLE_IMAGE_HOSTS;

function isTrustedHost(url: string): boolean {
  try {
    const u = new URL(url);
    return TRUSTED_IMAGE_HOSTS.includes(u.host);
  } catch {
    return false;
  }
}

export function isPlaceholder(url: string | undefined | null): boolean {
  if (!url) return true;
  if (PLACEHOLDER_HINTS.some((h) => url.includes(h))) return true;
  if (!isTrustedHost(url)) return true;
  return false;
}

export function usableImages(images: readonly (string | undefined | null)[] | undefined | null): string[] {
  if (!images) return [];
  return images.filter((u): u is string => !!u && !isPlaceholder(u));
}
