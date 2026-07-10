import type { MetadataRoute } from "next";
import { SITE_NAME } from "@/lib/seo";

// PWA / Add-to-Home-Screen manifest. The favicon + apple-touch icons are
// auto-wired by app/icon.png + app/apple-icon.png; this covers install icons.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: "WhatsLocal",
    description:
      "Discover the local makers, vendors, artists, and organizers building community life around you.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#14224d",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
