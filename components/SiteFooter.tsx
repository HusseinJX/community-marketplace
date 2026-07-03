"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Mail } from "lucide-react";
import { FeedbackLink } from "@/components/FeedbackWidget";

// Marketing footer. Hidden on full-screen app views (the conversation view)
// where a footer below the chat would be out of place.
export function SiteFooter() {
  const pathname = usePathname();
  if (pathname?.startsWith("/messages")) return null;

  return (
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
              <li><Link href="/browse" className="hover:text-indigo-700">Atlas</Link></li>
              <li><Link href="/vendor/organize" className="hover:text-indigo-700">Community events</Link></li>
              <li><Link href="/vendor" className="hover:text-indigo-700">Admin demo</Link></li>
              <li><Link href="/city" className="hover:text-indigo-700">Places</Link></li>
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
          <p>© {new Date().getFullYear()} WhatsLocal AI. Made in LA.</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Link href="/privacy" className="hover:text-indigo-700">Privacy</Link>
            <Link href="/terms" className="hover:text-indigo-700">Terms</Link>
            <Link href="/sms" className="hover:text-indigo-700">Text WhatsLocal</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
