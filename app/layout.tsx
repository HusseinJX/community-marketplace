import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { ClerkProvider } from "@clerk/nextjs";
import { Mail } from "lucide-react";
import { TopNav } from "@/components/TopNav";
import { BottomNav } from "@/components/BottomNav";
import { StoreProvider } from "@/lib/store";
import { PostHogProvider } from "@/lib/posthog-provider";
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

            <footer className="mt-16 border-t border-stone-200 bg-white">
              <div className="mx-auto max-w-7xl px-4 py-12 md:px-8">
                <div className="grid gap-10 md:grid-cols-4">
                  <div className="md:col-span-2">
                    <Link href="/" className="text-lg font-semibold tracking-tight text-stone-900">
                      WhatsLocal AI
                    </Link>
                    <p className="mt-3 max-w-sm text-sm text-stone-600">
                      A network of vendors, artists, organizers, and neighbors building the local economy together.
                    </p>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-stone-900">Explore</h4>
                    <ul className="mt-3 space-y-2 text-sm text-stone-600">
                      <li><Link href="/" className="hover:text-indigo-700">Atlas</Link></li>
                      <li><Link href="/events" className="hover:text-indigo-700">Feed</Link></li>
                      <li><Link href="/category" className="hover:text-indigo-700">Categories</Link></li>
                      <li><Link href="/city" className="hover:text-indigo-700">Places</Link></li>
                      <li><Link href="/cart" className="hover:text-indigo-700">Shop</Link></li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-stone-900">Connect</h4>
                    <ul className="mt-3 space-y-2 text-sm text-stone-600">
                      <li>
                        <a href="https://instagram.com" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 hover:text-indigo-700">
                          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                            <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                            <circle cx="12" cy="12" r="4"/>
                            <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" stroke="none"/>
                          </svg>
                          Instagram
                        </a>
                      </li>
                      <li>
                        <a href="mailto:hello@whatslocal.ai" className="inline-flex items-center gap-1.5 hover:text-indigo-700">
                          <Mail className="h-4 w-4" /> Email us
                        </a>
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="mt-10 flex flex-col items-start justify-between gap-3 border-t border-stone-200 pt-6 text-xs text-stone-500 sm:flex-row sm:items-center">
                  <p>© {new Date().getFullYear()} WhatsLocal AI. Made in LA.</p>
                  <p>Built with care for local communities.</p>
                </div>
              </div>
            </footer>

            {/* Spacer so content clears the fixed bottom nav */}
            <div style={{ height: "calc(3.25rem + env(safe-area-inset-bottom))" }} aria-hidden />
            <BottomNav />
          </StoreProvider>
          </PostHogProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
