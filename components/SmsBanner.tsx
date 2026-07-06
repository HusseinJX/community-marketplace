"use client";

import Link from "next/link";
import { Phone, X } from "lucide-react";
import { useState } from "react";
import { usePathname } from "next/navigation";

const CALL_VANITY = "+1-LOCAL-REACH"; // spells 562-257-3224
const CALL_NUMBER_TEL = "+15622573224";

// Slim, dismissible banner inviting members to call to join. Shown only inside the
// vendor admin portal (/vendor/*) so it's a vendor-facing prompt, not site-wide.
// Dismissal only hides it for the current page view — it shows again on reload.
export function SmsBanner() {
  const [hidden, setHidden] = useState(false);
  const pathname = usePathname();

  // Vendor admin only.
  if (!pathname?.startsWith("/vendor")) return null;
  if (hidden) return null;

  return (
    <div className="relative z-40 bg-gradient-to-r from-purple-700 to-pink-700 text-white">
      <div className="mx-auto flex max-w-7xl items-center gap-2 px-3 py-3.5 text-sm sm:gap-3 sm:px-4 sm:py-4 md:px-8">
        <Phone className="h-4 w-4 shrink-0" />
        <p className="min-w-0 flex-1 truncate leading-snug sm:whitespace-normal">
          <span className="font-semibold">Call {CALL_VANITY} to join</span>
          <span className="hidden text-white/80 sm:inline"> — set up your profile &amp; connect locally. </span>
          <Link href="/sms" className="hidden underline underline-offset-2 hover:text-white sm:inline">
            How it works
          </Link>
        </p>
        <a
          href={`tel:${CALL_NUMBER_TEL}`}
          className="shrink-0 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold transition hover:bg-white/25"
        >
          <span className="sm:hidden">Call</span>
          <span className="hidden sm:inline">Call to join</span>
        </a>
        <button
          type="button"
          onClick={() => setHidden(true)}
          aria-label="Dismiss"
          className="shrink-0 rounded-full p-1 text-white/80 transition hover:bg-white/15 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
