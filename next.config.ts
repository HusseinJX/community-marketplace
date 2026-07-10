import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit a self-contained server bundle so the Docker/CapRover image stays small.
  output: "standalone",
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
    ],
    formats: ["image/avif", "image/webp"],
    deviceSizes: [400, 640, 768, 1024, 1280],
    imageSizes: [128, 256, 400, 640, 768],
    minimumCacheTTL: 31536000,
  },
  // Apple requires the app-site-association file to be served as JSON (no
  // redirect) for Universal Links — used so Clerk's OAuth callback returns into
  // the native app instead of Safari.
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
