"use client";

import Link from "next/link";
import { MessageSquare, X } from "lucide-react";
import { useState } from "react";

const SMS_VANITY = "+1-LOCAL-REACH"; // spells 562-257-3224
const SMS_NUMBER_TEL = "+15622573224";

// Slim, dismissible site-wide banner inviting members to text to join. Reinforces
// the text-first (consumer-initiated) opt-in and links to the /sms program page.
// Dismissal only hides it for the current page view — it shows again on reload.
export function SmsBanner() {
  const [hidden, setHidden] = useState(false);

  if (hidden) return null;

  return (
    <div className="relative z-40 bg-gradient-to-r from-purple-700 to-pink-700 text-white">
      <div className="mx-auto flex max-w-7xl items-center gap-2 px-3 py-3.5 text-sm sm:gap-3 sm:px-4 sm:py-4 md:px-8">
        <MessageSquare className="h-4 w-4 shrink-0" />
        <p className="min-w-0 flex-1 truncate leading-snug sm:whitespace-normal">
          <span className="font-semibold">Text {SMS_VANITY} to join</span>
          <span className="hidden text-white/80 sm:inline"> — set up your profile &amp; connect locally. </span>
          <Link href="/sms" className="hidden underline underline-offset-2 hover:text-white sm:inline">
            How it works
          </Link>
          <span className="hidden text-white/60 sm:inline"> · Msg &amp; data rates may apply.</span>
        </p>
        <a
          href={`sms:${SMS_NUMBER_TEL}`}
          className="shrink-0 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold transition hover:bg-white/25"
        >
          <span className="sm:hidden">Text</span>
          <span className="hidden sm:inline">Text to join</span>
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
