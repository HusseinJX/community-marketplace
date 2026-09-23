"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Heart, MessageCircle, ShoppingBag } from "lucide-react";

const ITEMS = [
  { href: "/cart", label: "Cart", icon: ShoppingBag },
  { href: "/favorites", label: "Saved", icon: Heart },
  { href: "/messages", label: "Messages", icon: MessageCircle },
];

export function CartNavMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label="Cart, saved, and messages"
        aria-expanded={open}
        aria-haspopup="menu"
        className="grid h-10 w-10 place-items-center rounded-full border border-stone-200 bg-white text-stone-600 transition hover:shadow-[var(--shadow-float)]"
      >
        <ShoppingBag className="h-[18px] w-[18px]" />
      </button>

      {open && (
        <div
          role="menu"
          // z above the header itself (z-30) so the panel is never clipped by
          // the band below it.
          className="absolute right-0 top-[calc(100%+8px)] z-[50] w-52 overflow-hidden rounded-[var(--r-lg)] border border-stone-200 bg-white py-2 shadow-[var(--shadow-overlay)]"
        >
          {ITEMS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              role="menuitem"
              href={href}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 t-body text-stone-700 transition hover:bg-stone-50"
            >
              <Icon className="h-4 w-4 shrink-0 text-stone-400" />
              {label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
