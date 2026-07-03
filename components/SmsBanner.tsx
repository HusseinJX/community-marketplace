"use client";

import Link from "next/link";
import { MessageSquare, X } from "lucide-react";
import { useEffect, useState } from "react";

const SMS_VANITY = "+1-LOCAL-REACH"; // spells 562-257-3224
const SMS_NUMBER_TEL = "+15622573224";

// Slim, dismissible site-wide banner inviting members to text to join. Reinforces
// the text-first (consumer-initiated) opt-in and links to the /sms program page.
export function SmsBanner() {
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    setHidden(localStorage.getItem("sms-banner-dismissed") === "1");
  }, []);

  if (hidden) return null;

  return (
    <div className="relative z-40 bg-gradient-to-r from-purple-700 to-pink-700 text-white">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2 text-sm md:px-8">
        <MessageSquare className="hidden h-4 w-4 shrink-0 sm:block" />
        <p className="flex-1 leading-snug">
          <span className="font-semibold">Text {SMS_VANITY} to join</span>{" "}
          <span className="text-white/80">— set up your profile &amp; connect locally.</span>{" "}
          <Link href="/sms" className="underline underline-offset-2 hover:text-white">
            How it works
          </Link>
          <span className="hidden text-white/60 sm:inline"> · Msg &amp; data rates may apply.</span>
        </p>
        <a
          href={`sms:${SMS_NUMBER_TEL}`}
          className="hidden shrink-0 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold transition hover:bg-white/25 sm:inline-block"
        >
          Text to join
        </a>
        <button
          type="button"
          onClick={() => { localStorage.setItem("sms-banner-dismissed", "1"); setHidden(true); }}
          aria-label="Dismiss"
          className="shrink-0 rounded-full p-1 text-white/80 transition hover:bg-white/15 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
