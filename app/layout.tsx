import type { Metadata, Viewport } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { TopNav } from "@/components/TopNav";
import { BottomNav } from "@/components/BottomNav";
import { SiteFooter } from "@/components/SiteFooter";
import { StoreProvider } from "@/lib/store";
import { LocationProvider } from "@/lib/location";
import { PostHogProvider } from "@/lib/posthog-provider";
import { FeedbackWidget } from "@/components/FeedbackWidget";
import { SITE_NAME, SITE_URL } from "@/lib/seo";
import "./globals.css";

const SITE_DESCRIPTION =
  "Discover the local makers, vendors, artists, and organizers building community life around you.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — Discover local makers, vendors & events`,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: `${SITE_NAME} — Discover local makers, vendors & events`,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — Discover local makers, vendors & events`,
    description: SITE_DESCRIPTION,
  },
};

// viewport-fit=cover lets the page extend under the notch; the sticky header
// then pads itself by the safe-area inset so its content sits below the status
// bar in the native (Capacitor) app. No-op (0px insets) on web/desktop.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Lock scale so iOS doesn't auto-zoom on input focus (and leave it zoomed)
  // — gives the native app a stable, app-like feel.
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <ClerkProvider>
      <html lang="en" className="h-full antialiased">
        <body className="flex min-h-full flex-col overflow-x-hidden bg-stone-50 text-stone-900">
          <PostHogProvider>
          <LocationProvider>
          <StoreProvider>
            <header
              className="sticky top-0 z-30 border-b border-stone-200 bg-stone-50/80 backdrop-blur"
              style={{ paddingTop: "env(safe-area-inset-top)" }}
            >
              <div className="mx-auto max-w-7xl">
                <TopNav />
              </div>
            </header>

            <main className="flex-1">{children}</main>

            <SiteFooter />

            {/* Spacer so content clears the fixed bottom nav */}
            <div style={{ height: "calc(3.25rem + env(safe-area-inset-bottom))" }} aria-hidden />
            <BottomNav />
            <FeedbackWidget />
          </StoreProvider>
          </LocationProvider>
          </PostHogProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
