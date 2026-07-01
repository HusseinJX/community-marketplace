"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Store, Radio, Send, Search, User } from "lucide-react";

// Instagram-style bottom tab bar. Some destinations map to the nearest existing
// surface until dedicated features land (Messages→stub, Search→browse).
const ITEMS = [
  { href: "/", label: "Live", icon: Radio },
  { href: "/browse", label: "Browse", icon: Store },
  { href: "/messages", label: "Messages", icon: Send },
  { href: "/explore", label: "Search", icon: Search },
  { href: "/shopper", label: "Profile", icon: User },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-stone-200 bg-white/95 backdrop-blur"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto flex max-w-2xl items-center justify-around px-2">
        {ITEMS.map((it) => {
          const Icon = it.icon;
          const active = it.href === "/" ? pathname === "/" : pathname.startsWith(it.href);
          return (
            <Link
              key={it.href}
              href={it.href}
              aria-label={it.label}
              className={
                "flex flex-1 items-center justify-center py-3 transition " +
                (active ? "text-stone-900" : "text-stone-400 hover:text-stone-600")
              }
            >
              <Icon className="h-6 w-6" strokeWidth={active ? 2.4 : 2} />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
