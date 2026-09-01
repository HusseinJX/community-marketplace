"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, User, Clapperboard } from "lucide-react";
import { FEATURES } from "@/lib/features";

/**
 * The shopper tab bar.
 *
 * ── What changed ─────────────────────────────────────────────────────────────
 * It was two unlabelled icons — Local and Profile — while /favorites, /tickets
 * and /messages were all built, working, and reachable only by typing the URL.
 * Two tabs is not a tab bar; it is a pair of buttons.
 *
 * Labels are back, because every app people actually use labels them. An
 * unlabelled compass is a guess, and the guess costs a tap to check. The bar is
 * 8px taller for it, which is the cheapest 8px in the app.
 *
 * Saved, Tickets and Cart moved into the top-row cart menu on mobile, keeping
 * the bottom bar focused on primary movement rather than account utilities.
 */
const ITEMS = [
  { href: "/", label: "Explore", icon: Compass },
  ...(FEATURES.shorts ? [{ href: "/shorts", label: "Shorts", icon: Clapperboard }] : []),
  { href: "/shopper", label: "Profile", icon: User },
];

export function BottomNav() {
  const pathname = usePathname();

  // Shown app-wide, including the vendor portal, so Home/Profile is always one
  // tap away. (The global spacer in app/layout.tsx reserves room for it.)

  return (
    // MOBILE ONLY. A tab bar pinned across the foot of a 1440px window is a
    // phone control wearing a desktop, and it duplicates the profile avatar in
    // the top nav — two ways to the same page, neither obviously primary. On
    // desktop the header carries it instead; on a phone the header's avatar
    // hides and this owns it.
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-stone-200 bg-white/95 backdrop-blur md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto flex max-w-2xl items-stretch justify-around px-2">
        {ITEMS.map((it) => {
          const Icon = it.icon;
          // Explore owns everything that isn't claimed by a specific tab, so it
          // is the only one that has to be defined by exclusion. Listing the
          // others explicitly means adding a tab can't silently make Explore
          // look active on that tab's own pages.
          const owned = ITEMS.filter((t) => t.href !== "/").map((t) => t.href);
          const active =
            it.href === "/"
              ? !owned.some((h) => pathname.startsWith(h))
              : pathname.startsWith(it.href);
          return (
            <Link
              key={it.href}
              href={it.href}
              aria-label={it.label}
              aria-current={active ? "page" : undefined}
              className={
                "flex flex-1 flex-col items-center justify-center gap-1 py-2 transition " +
                (active ? "text-coral-600" : "text-stone-400 hover:text-stone-700")
              }
            >
              <Icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.3 : 1.9} />
              <span className={"text-[10px] leading-none " + (active ? "font-semibold" : "font-medium")}>
                {it.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
