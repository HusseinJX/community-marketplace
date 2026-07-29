"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Mail } from "lucide-react";
import { FeedbackLink } from "@/components/FeedbackWidget";

// Marketing footer. Hidden on full-screen app views (the conversation views)
// where a footer below the chat would be out of place — a chat fills the screen
// and pins its input above the bottom nav, so there is no "below" to put it in.
// Both inboxes count: the vendor portal's is as much a chat surface as the
// shopper one, and it was getting 354px of marketing under the message box.
const FULL_SCREEN = ["/messages", "/vendor/messages"];

export function SiteFooter() {
  const pathname = usePathname();
  if (FULL_SCREEN.some((p) => pathname?.startsWith(p))) return null;

  return (
    <footer className="mt-16 border-t border-stone-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-12 md:px-8">
        {/* brand(2) + Explore + Connect = 4 columns. The brand spans 2, so the
            column count has to stay one ahead of the number of link columns. */}
        <div className="grid gap-10 md:grid-cols-4">
          <div className="md:col-span-2">
            <Link href="/" className="inline-flex items-center gap-2 text-lg font-semibold tracking-tight text-stone-900">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="" className="h-8 w-8" />
              WhatsLocal AI
            </Link>
            <p className="mt-3 max-w-sm text-sm text-stone-600">
              Local businesses team up to put on events. Neighbors find them.
            </p>
          </div>

          {/* One column now — the "Your business" section was folded away. */}
          <div>
            <h4 className="text-sm font-semibold text-stone-900">Explore</h4>
            <ul className="mt-3 space-y-2 text-sm text-stone-600">
              <li><Link href="/join" className="hover:text-indigo-700">Add your business</Link></li>
              <li><Link href="/vendor/sign-in" className="hover:text-indigo-700">Business login</Link></li>
              <li><Link href="/organizers" className="hover:text-indigo-700">Run an event</Link></li>
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
              <li>
                <FeedbackLink className="inline-flex items-center gap-1.5 hover:text-indigo-700" />
              </li>
            </ul>
          </div>
        </div>

        {/* Directory hubs get their own quiet row. /city and /category are the
            SEO landing pages and internal links are how crawlers weight them, so
            these have to stay real, visible links — de-emphasised, not hidden. */}
        <div className="mt-10 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-stone-200 pt-6 text-xs text-stone-400">
          <span className="font-medium text-stone-500">Browse</span>
          <Link href="/explore" className="transition hover:text-indigo-700">All businesses</Link>
          <Link href="/city" className="transition hover:text-indigo-700">Places</Link>
          <Link href="/category" className="transition hover:text-indigo-700">Categories</Link>
          <Link href="/browse" className="transition hover:text-indigo-700">Atlas</Link>
        </div>

        <div className="mt-6 flex flex-col items-start justify-between gap-3 text-xs text-stone-500 sm:flex-row sm:items-center">
          <p>© {new Date().getFullYear()} WhatsLocal AI.</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Link href="/about" className="hover:text-indigo-700">About</Link>
            <Link href="/privacy" className="hover:text-indigo-700">Privacy</Link>
            <Link href="/terms" className="hover:text-indigo-700">Terms</Link>
            <Link href="/sms" className="hover:text-indigo-700">Text WhatsLocal</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
