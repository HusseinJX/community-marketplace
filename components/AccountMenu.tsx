"use client";

import Link from "next/link";
import { useAuth, UserButton } from "@clerk/nextjs";
import { User } from "lucide-react";

/**
 * The profile control at the right of the top nav.
 *
 * ── Desktop only ─────────────────────────────────────────────────────────────
 * On a phone the bottom tab bar already carries Profile, and two profile
 * targets on one screen is one too many — you tap the nearer one and wonder
 * what the other does. So this hides below `md` and the tab bar owns it there,
 * while on desktop there is no tab bar (BottomNav is mobile-only now) and this
 * is the only way in.
 *
 * ── A circle, not a menu ─────────────────────────────────────────────────────
 * It was a hamburger-plus-avatar capsule opening a dropdown of Saved, Tickets,
 * Messages, Cart and Account. That dropdown duplicated /shopper, which already
 * lists every one of those as a card — so the same six destinations existed in
 * two places that could drift apart. Now the avatar goes straight to /shopper
 * and that page is the single list.
 */
export function AccountMenu() {
  const { isSignedIn } = useAuth();

  // ALWAYS /shopper, signed in or not. It briefly opened the login modal when
  // signed out, on the reasoning that /shopper would be an empty prompt — but
  // that page carries both doors (shopper login AND vendor login) plus the
  // things that work signed-out, so sending everyone to the same place is both
  // simpler and more useful. One control, one destination, no state to learn.
  return (
    <Link
      href="/shopper"
      aria-label={isSignedIn ? "Your space" : "Log in"}
      className="hidden h-10 w-10 place-items-center overflow-hidden rounded-full border border-stone-200 bg-white text-stone-600 transition hover:shadow-[var(--shadow-float)] md:grid"
    >
      {isSignedIn ? (
        // Clerk's avatar, but inert — the whole circle is the link, so its own
        // popover must not open inside ours.
        <span className="pointer-events-none">
          <UserButton />
        </span>
      ) : (
        <User className="h-[18px] w-[18px]" />
      )}
    </Link>
  );
}
