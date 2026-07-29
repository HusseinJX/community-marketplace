"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, User, Clapperboard } from "lucide-react";
import { FEATURES } from "@/lib/features";

// Shopper tabs: a "Local" page (live now + events + directory), a "Shorts"
// reels feed, and Profile (account, tickets, orders, cart). Buying/booking are
// flows off cards on Local. Messages lives INSIDE the shopper space.
// The Shorts tab is parked until the reels feed ships (lib/features.ts `shorts`).
const ITEMS = [
  { href: "/", label: "Local", icon: Compass },
  ...(FEATURES.shorts ? [{ href: "/shorts", label: "Shorts", icon: Clapperboard }] : []),
  { href: "/shopper", label: "Profile", icon: User },
];

export function BottomNav() {
  const pathname = usePathname();

  // The shopper bottom nav (Local/Profile) has no place in the vendor portal —
  // the vendor pages (incl. the admin demo) have their own layout/nav.
  if (pathname.startsWith("/vendor")) return null;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-stone-200 bg-white/95 backdrop-blur"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto flex max-w-2xl items-center justify-around px-2">
        {ITEMS.map((it) => {
          const Icon = it.icon;
          // Profile owns /shopper/*, Shorts owns /shorts/*, "Local" owns the rest.
          const active =
            it.href === "/"
              ? !pathname.startsWith("/shopper") && !pathname.startsWith("/shorts")
              : pathname.startsWith(it.href);
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
