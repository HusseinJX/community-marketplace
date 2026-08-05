import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit a self-contained server bundle so the Docker/CapRover image stays small.
  output: "standalone",
  // Reverse-proxy PostHog through our own origin (/ingest) so ad blockers, which
  // block requests to *.posthog.com by name, don't silently drop 15-30% of our
  // analytics. posthog-js is pointed at "/ingest" (see lib/posthog-provider).
  // Required by PostHog's proxy so trailing-slash handling doesn't 308 its API.
  skipTrailingSlashRedirect: true,
  async rewrites() {
    return [
      { source: "/ingest/static/:path*", destination: "https://us-assets.i.posthog.com/static/:path*" },
      { source: "/ingest/:path*", destination: "https://us.i.posthog.com/:path*" },
    ];
  },
  experimental: {
    // Cache the RSC payload of visited routes in the client Router Cache so
    // back/forward and tab-to-tab navigation reuse the rendered page instead of
    // re-fetching it from the server. `dynamic` defaults to 0 (off) in Next 15+;
    // 30s makes bouncing between nav tabs feel instant without going stale.
    staleTimes: { dynamic: 30, static: 300 },
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      // Supabase Storage (marketplace-media) — uploads, product + profile images
      { protocol: "https", hostname: "xbbnvkvlrucrzobhopgh.supabase.co" },
      // ProLocalIQ DigitalOcean Spaces — imported business hero photos
      { protocol: "https", hostname: "zahabbucket.nyc3.digitaloceanspaces.com" },
      { protocol: "https", hostname: "zahabbucket.nyc3.cdn.digitaloceanspaces.com" },
      // SF Legacy Business heroes (some imports point here when Spaces missing)
      { protocol: "https", hostname: "legacybusiness.org" },
      // Google Places photos (Oakland harvest, future imports)
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "maps.googleapis.com" },

      // ── Scraped-event posters (one per watched calendar in lib/sources/registry.ts)
      //
      // These are safe to enumerate BECAUSE the source list is hand-curated —
      // this is not the open web. An unlisted host is not a soft failure:
      // next/image throws outright in dev, and in production every optimizer
      // request 400s, which is how 546 harvested events shipped with broken
      // posters. ADDING A SOURCE MEANS ADDING ITS IMAGE HOST HERE.
      { protocol: "https", hostname: "cdn.funcheap.com" },
      { protocol: "https", hostname: "fortmason.org" },
      { protocol: "https", hostname: "localist-images.azureedge.net" }, // UCSF / Localist
      { protocol: "https", hostname: "gggp.org" },
      { protocol: "https", hostname: "img.ctykit.com" }, // Downtown SF
      { protocol: "https", hostname: "ybgfestival.org" },
      { protocol: "https", hostname: "images.lumacdn.com" }, // TIAT / Luma
      { protocol: "https", hostname: "images.squarespace-cdn.com" }, // La Cocina
    ],
    formats: ["image/avif", "image/webp"],
    deviceSizes: [400, 640, 768, 1024, 1280],
    imageSizes: [128, 256, 400, 640, 768],
    minimumCacheTTL: 31536000,
  },
  // Apple requires the app-site-association file to be served as JSON (no
  // redirect) for Universal Links.
  //
  // Originally added so Clerk's OAuth callback returned into the native app
  // instead of Safari; the file now also claims the CONTENT paths, which is
  // what makes an NFC fob or a shared link open the app rather than the
  // website. The fob encodes `…/members/{id}` (see QrScanButton), so without
  // `/members/*` in that file a tap went to Safari no matter what the app's
  // entitlements said. `/checkout` is deliberately NOT claimed — a payment
  // returning from Stripe should finish in the browser it started in.
  //
  // The file itself must stay pure JSON (no comments), hence this note here.
  async headers() {
    return [
      {
        source: "/.well-known/apple-app-site-association",
        headers: [{ key: "Content-Type", value: "application/json" }],
      },
    ];
  },
};

export default nextConfig;
