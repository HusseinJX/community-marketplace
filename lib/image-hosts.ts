// The one list of image hosts, read by BOTH next/image and the display filter.
//
// These were two separate lists and they disagreed, which cost the whole event
// feed its pictures: `next.config.ts` had every scraped poster host enumerated,
// while `lib/image-utils.ts` trusted three hosts (our own storage plus
// Unsplash). `usableImages()` therefore threw away every harvested poster, so
// `ImageCarousel` rendered nothing and the card silently collapsed — the images
// were in the database and in the API payload the entire time.
//
// Keep them here, together, so a new source cannot be half-added again.

/** Our own storage. Anything here we uploaded. */
export const OWN_MEDIA_HOSTS = [
  "xbbnvkvlrucrzobhopgh.supabase.co", // Supabase Storage (marketplace-media)
  "zahabbucket.nyc3.digitaloceanspaces.com", // DO Spaces — imported business heroes
  "zahabbucket.nyc3.cdn.digitaloceanspaces.com",
  "images.unsplash.com", // hand-curated MEMBER_HERO_IMAGES only
] as const;

/**
 * Scraped-event poster hosts — one per watched calendar in
 * `lib/sources/registry.ts`.
 *
 * Safe to enumerate BECAUSE the source list is hand-curated; this is not the
 * open web. ADDING A SOURCE MEANS ADDING ITS IMAGE HOST HERE — an unlisted host
 * makes next/image throw in dev and 400 in production.
 */
export const EVENT_POSTER_HOSTS = [
  "cdn.funcheap.com",
  "fortmason.org",
  "localist-images.azureedge.net", // UCSF / Localist
  "gggp.org",
  "img.ctykit.com", // Downtown SF
  "ybgfestival.org",
  "images.lumacdn.com", // TIAT / Luma
  "images.squarespace-cdn.com", // La Cocina
  "sfpl.org", // SF Public Library
] as const;

/**
 * Hosts next/image may FETCH but that we deliberately do NOT display.
 *
 * `legacybusiness.org` is hotlinked third-party imagery from an old import: it
 * stays optimizable so an existing URL doesn't hard-error, but `usableImages()`
 * still drops it in favour of a gradient. Distrust is the point — do not "fix"
 * this by promoting it.
 */
export const TOLERATED_IMAGE_HOSTS = [
  "legacybusiness.org",
  "lh3.googleusercontent.com", // Google Places photos
  "maps.googleapis.com",
] as const;

/** Everything next/image is allowed to optimise. */
export const REMOTE_IMAGE_HOSTS: readonly string[] = [
  ...OWN_MEDIA_HOSTS,
  ...EVENT_POSTER_HOSTS,
  ...TOLERATED_IMAGE_HOSTS,
];

/** Everything we are willing to actually SHOW. */
export const DISPLAYABLE_IMAGE_HOSTS: readonly string[] = [
  ...OWN_MEDIA_HOSTS,
  ...EVENT_POSTER_HOSTS,
];
