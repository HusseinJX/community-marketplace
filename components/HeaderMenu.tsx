"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Menu, Heart, ShoppingBag, MessageCircle } from "lucide-react";

/**
 * The overflow menu, right of the profile circle. Desktop only.
 *
 * Three destinations that people come BACK for. On a phone the tab bar already
 * carries Saved and Cart, so this hides below `md` — the same split the profile
 * circle makes.
 *
 * Deliberately NOT a second copy of /shopper. The avatar beside this goes there
 * and that page is the full list; this is the shortcut to the three you reach
 * for mid-browse, and it should stay three. The version of this that existed
 * earlier in the session listed six items and duplicated the whole page, which
 * is exactly how two navigations drift apart.
 */
const ITEMS = [
  { href: "/cart", label: "Cart", icon: ShoppingBag },
  { href: "/favorites", label: "Saved", icon: Heart },
  { href: "/messages", label: "Messages", icon: MessageCircle },
];

export function HeaderMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click and on Escape. Both, because a menu that only
  // closes one way is a menu people end up tapping around.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative hidden md:block">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Menu"
        aria-expanded={open}
        aria-haspopup="menu"
        className="grid h-10 w-10 place-items-center rounded-full border border-stone-200 bg-white text-stone-600 transition hover:shadow-[var(--shadow-float)]"
      >
        <Menu className="h-[18px] w-[18px]" />
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
