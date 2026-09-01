"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Heart, ShoppingBag, Ticket } from "lucide-react";

const ITEMS = [
  { href: "/favorites", label: "Saved", icon: Heart },
  { href: "/tickets", label: "Tickets", icon: Ticket },
  { href: "/cart", label: "Cart", icon: ShoppingBag },
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
        aria-label="Saved, tickets, and cart"
        aria-expanded={open}
        aria-haspopup="menu"
        className="grid h-10 w-10 place-items-center rounded-full border border-stone-200 bg-white text-stone-700 shadow-[0_1px_0_rgba(28,25,23,0.04)] transition hover:border-stone-300 hover:shadow-[var(--shadow-float)]"
      >
        <ShoppingBag className="h-[18px] w-[18px]" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+8px)] z-[50] w-40 overflow-hidden rounded-[var(--r-lg)] border border-stone-200 bg-white py-2 shadow-[var(--shadow-overlay)]"
        >
          {ITEMS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              role="menuitem"
              href={href}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-stone-800 transition hover:bg-stone-50"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-stone-100 text-stone-600">
                <Icon className="h-4 w-4" />
              </span>
              <span className="t-meta font-semibold text-stone-900">{label}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
