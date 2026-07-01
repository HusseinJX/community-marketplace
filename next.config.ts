import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit a self-contained server bundle so the Docker/CapRover image stays small.
  output: "standalone",
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
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
};

export default nextConfig;
