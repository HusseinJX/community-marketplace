const PLACEHOLDER_HINTS = [
  "photo-1441986300917-64674bd600d8", // prolocaliq seed unsplash garbage
];

// Only trust images served from hosts we control or have intentionally curated.
// Everything else (legacybusiness.org hotlinks, random scraped URLs from the
// importer, etc.) is treated as "no image" so cards/profiles fall back to a
// gradient instead of showing a third-party link we don't control. Note: the
// prolocaliq Unsplash placeholder is still caught separately by
// PLACEHOLDER_HINTS so it doesn't slip through via the unsplash whitelist.
const TRUSTED_IMAGE_HOSTS = [
  "zahabbucket.nyc3.digitaloceanspaces.com", // our DO Spaces bucket
  "images.unsplash.com",                     // hand-curated MEMBER_HERO_IMAGES set
];

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
