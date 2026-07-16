"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Mail } from "lucide-react";
import { FeedbackLink } from "@/components/FeedbackWidget";
import { writeDemoCookies } from "@/lib/demo-admin";

// Enter the admin demo directly — set the demo cookie (default: vendor) and go
// straight to the portal, skipping the /demo type-picker page.
function openAdminDemo() {
  writeDemoCookies("vendor", "");
  window.location.href = "/vendor";
}

// Marketing footer. Hidden on full-screen app views (the conversation view)
// where a footer below the chat would be out of place.
export function SiteFooter() {
  const pathname = usePathname();
  if (pathname?.startsWith("/messages")) return null;

  return (
    <footer className="mt-16 border-t border-stone-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-12 md:px-8">
        {/* brand(2) + Explore + Your business + Connect = 5 columns. On
            grid-cols-4 the brand's col-span-2 filled the row and pushed Connect
            onto a second one. */}
        <div className="grid gap-10 md:grid-cols-5">
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

          {/* Explore stays — /city and /category are the SEO landing hubs, and
              internal links are how crawlers weight them. (The Community column —
              SF, World Cup, resources, petitions — was removed: supporting cast.
              Those routes are now unlinked, which is the honest signal that they
              should either be deleted or earn their way back.) */}
          <div>
            <h4 className="text-sm font-semibold text-stone-900">Explore</h4>
            <ul className="mt-3 space-y-2 text-sm text-stone-600">
              <li><Link href="/explore" className="hover:text-indigo-700">All businesses</Link></li>
              <li><Link href="/city" className="hover:text-indigo-700">Places</Link></li>
              <li><Link href="/category" className="hover:text-indigo-700">Categories</Link></li>
              <li><Link href="/browse" className="hover:text-indigo-700">Atlas</Link></li>
              <li><button type="button" onClick={openAdminDemo} className="hover:text-indigo-700">Admin demo</button></li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-stone-900">Your business</h4>
            <ul className="mt-3 space-y-2 text-sm text-stone-600">
              {/* The two public front doors for supply. (For organizers was
                  /vendor/organize — auth-gated, so it dead-ended logged-out
                  organizers at a sign-in wall.) */}
              <li><Link href="/businesses" className="hover:text-indigo-700">Find collaborators</Link></li>
              <li><Link href="/organizers" className="hover:text-indigo-700">Run an event</Link></li>
              <li><Link href="/join" className="hover:text-indigo-700">Add your business</Link></li>
              <li><Link href="/vendor" className="hover:text-indigo-700">Business login</Link></li>
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

        <div className="mt-10 flex flex-col items-start justify-between gap-3 border-t border-stone-200 pt-6 text-xs text-stone-500 sm:flex-row sm:items-center">
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
