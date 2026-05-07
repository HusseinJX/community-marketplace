import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Community Marketplace",
  description: "Discover the people, makers, and events shaping your community.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <header className="border-b border-stone-200 bg-white/80 backdrop-blur sticky top-0 z-10">
          <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
            <Link href="/" className="flex items-center gap-2 text-lg font-semibold text-stone-900">
              <span className="inline-block h-6 w-6 rounded-full bg-indigo-600" />
              Community
            </Link>
            <div className="flex items-center gap-6 text-sm font-medium text-stone-600">
              <Link href="/" className="hover:text-indigo-700">Browse</Link>
              <Link href="/events" className="hover:text-indigo-700">Events</Link>
            </div>
          </nav>
        </header>

        <main className="flex-1">{children}</main>

        <footer className="border-t border-stone-200 bg-white/60 py-6 text-center text-xs text-stone-500">
          Community Marketplace
        </footer>
      </body>
    </html>
  );
}
