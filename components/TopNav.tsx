"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, ShoppingBag, ChevronDown } from "lucide-react";
import { useStore } from "@/lib/store";

const MENU = [
  { href: "/", label: "Home" },
  { href: "/events", label: "Feed" },
];

// Instagram-style top bar: left "+" (post/share), center "WhatsLocal" dropdown
// (Home/index + Feed — Live & Browse live in the bottom nav), right cart + profile.
export function TopNav() {
  const { cart } = useStore();
  const [open, setOpen] = useState(false);

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

      {/* Center — brand dropdown */}
      <div className="flex justify-center">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-1 text-lg font-semibold tracking-tight text-stone-900"
        >
          WhatsLocal
          <ChevronDown className={`h-4 w-4 text-stone-500 transition ${open ? "rotate-180" : ""}`} />
        </button>

        {open && (
          <>
            <button
              type="button"
              aria-label="Close menu"
              className="fixed inset-0 z-30 cursor-default"
              onClick={() => setOpen(false)}
            />
            <div className="absolute left-1/2 top-full z-40 mt-2 w-44 -translate-x-1/2 divide-y divide-stone-100 rounded-2xl border border-stone-200 bg-white p-1 shadow-lg">
              {MENU.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-xl px-3 py-2.5 text-sm font-medium text-stone-800 transition hover:bg-stone-100"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </>
        )}
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
