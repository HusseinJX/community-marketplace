"use client";

import Link from "next/link";
import { Plus, ShoppingBag } from "lucide-react";
import { useStore } from "@/lib/store";

// Instagram-style top bar: left "+" (post/share), center "WhatsLocal" wordmark
// (links home; the feed now lives on the home scroll), right cart + profile.
export function TopNav() {
  const { cart } = useStore();

  return (
    <div className="relative grid h-14 grid-cols-3 items-center px-4">
      {/* Left — post/share */}
      <div className="flex justify-start">
        <Link
          href="/share"
          aria-label="Share a post"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-stone-800 transition hover:bg-stone-100"
        >
          <Plus className="h-6 w-6" />
        </Link>
      </div>

      {/* Center — brand wordmark (links home) */}
      <div className="flex justify-center">
        <Link
          href="/"
          className="text-lg font-semibold tracking-tight text-stone-900"
        >
          WhatsLocal
        </Link>
      </div>

      {/* Right — cart */}
      <div className="flex justify-end">
        <Link
          href="/cart"
          aria-label="Cart"
          className="relative inline-flex h-9 w-9 items-center justify-center rounded-full text-stone-800 transition hover:bg-stone-100"
        >
          <ShoppingBag className="h-6 w-6" />
          {cart.length > 0 && (
            <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-600 px-1 text-[10px] font-semibold text-white">
              {cart.length}
            </span>
          )}
        </Link>
      </div>
    </div>
  );
}
