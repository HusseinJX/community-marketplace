"use client";

import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { useStore } from "@/lib/store";
import { ThemeToggle } from "@/components/ThemeToggle";

// Top bar: theme toggle left, wordmark centered, cart right (only when it has
// something in it).
export function TopNav() {
  const { cart } = useStore();

  return (
    <div className="relative grid h-14 grid-cols-3 items-center px-4">
      {/* Left — the theme toggle, in the slot the "+" vacated.

          (The global "+" (share) is gone: a post's only home is the memories wall
          of the business/event it's tagged to, so a composer opened from nowhere
          left people asking "where does this even go?" — and an untagged post
          went nowhere at all. Posting now happens IN CONTEXT: "Post a photo" on a
          business profile, "Were you there?" on an event, and the same on a live
          broadcast. Vendors post/go live from the dashboard tile.) */}
      <div className="flex justify-start">
        <ThemeToggle />
      </div>

      {/* Center — brand lockup (mark + wordmark, links home) */}
      <div className="flex justify-center">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-lg font-semibold tracking-tight text-stone-900"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" className="h-7 w-7" />
          WhatsLocal
        </Link>
      </div>

      {/* Right — cart, ONLY when it has something in it. Commerce is supporting
          cast here; an always-empty bag was a dead control on the front door. */}
      <div className="flex justify-end">
        {cart.length > 0 && (
          <Link
            href="/cart"
            aria-label={`Cart (${cart.length})`}
            className="relative inline-flex h-9 w-9 items-center justify-center rounded-full text-stone-800 transition hover:bg-stone-100"
          >
            <ShoppingBag className="h-6 w-6" />
            <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-600 px-1 text-[10px] font-semibold text-white">
              {cart.length}
            </span>
          </Link>
        )}
      </div>
    </div>
  );
}
