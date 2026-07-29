"use client";

import Link from "next/link";
import { Show, UserButton, useUser, useClerk } from "@clerk/nextjs";
import { Heart, ShoppingBag, Users, ArrowRight, PenLine, Store, MessageCircle, LogOut } from "lucide-react";
import { PushTestButton } from "@/components/PushTestButton";
import { DeleteAccountButton } from "@/components/account/DeleteAccountButton";
import { useLogin } from "@/components/auth/ClerkAuthProvider";
import { useIsNativeApp } from "@/lib/native";
import { useStore } from "@/lib/store";

// The shopper's personal space (parallel to the vendor portal). A signed-in
// vendor never reaches this — app/shopper/page.tsx redirects them to /vendor
// server-side — so this is the shopper/guest view only.
export function ShopperClient() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const openLogin = useLogin();
  const isNative = useIsNativeApp();
  const { favorites, cart } = useStore();

  const cards = [
    { label: "Saved", value: favorites.length, href: "/favorites", icon: Heart },
    { label: "Cart", value: cart.length, href: "/cart", icon: ShoppingBag },
  ] as const;

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 md:px-8">

      {/* Top utility row (above the title). Signed out: choose which side to
          enter — "Vendor" (the vendor login/onboarding) or "Log in" as a
          shopper. Signed in as a shopper: only the account control (no vendor
          jump — shopper and vendor are separate accounts). */}
      <div className="flex items-center justify-between gap-2">
        <Show when="signed-out">
          <Link
            href="/join"
            className="inline-flex items-center gap-1.5 rounded-full border border-stone-300 px-3.5 py-2 text-[13px] font-semibold text-stone-800 transition hover:bg-stone-50"
          >
            <Store className="h-4 w-4 text-violet-600" /> Vendor login
          </Link>
        </Show>
        <Show
          when="signed-out"
          fallback={
            <div className="ml-auto flex shrink-0 items-center gap-2">
              <span className="max-w-[8rem] truncate text-sm font-medium text-stone-700">
                {user?.firstName || user?.fullName || user?.primaryEmailAddress?.emailAddress}
              </span>
              <UserButton />
            </div>
          }
        >
          <button
            onClick={() => openLogin({ redirectUrl: "/shopper" })}
            className="shrink-0 rounded-full bg-stone-900 px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-stone-800"
          >
            Shopper login
          </button>
        </Show>
      </div>

      {/* Title */}
      <div>
        <h1 className="text-xl font-semibold text-stone-900">Your space</h1>
        <p className="mt-1 text-sm text-stone-500">Everything you&apos;ve saved, ordered, and discovered nearby.</p>
      </div>

      {/* Quick access — compact metric grid */}
      <div>
        <p className="section-label mb-3">Quick access</p>
        <div className="grid grid-cols-2 gap-2">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <Link
                key={card.label}
                href={card.href}
                className="card-soft card-hover flex items-center gap-3 p-3.5"
              >
                <Icon className="h-5 w-5 shrink-0 text-teal-500" />
                <span className="min-w-0">
                  <span className="block text-[11px] font-medium leading-tight text-stone-500">{card.label}</span>
                  <span className="block text-lg font-semibold leading-tight text-stone-900">{card.value}</span>
                </span>
              </Link>
            );
          })}
        </div>

        {/* Messages lives here, in the shopper's own space — not as a nav tab. */}
        <Link href="/messages" className="card-soft card-hover mt-2 flex items-center justify-between p-4">
          <span className="flex items-center gap-3">
            <MessageCircle className="h-5 w-5 shrink-0 text-teal-500" />
            <span>
              <span className="block text-sm font-semibold text-stone-900">Messages</span>
              <span className="block text-xs text-stone-500">
                Your WhatsLocal assistant and conversations with local businesses.
              </span>
            </span>
          </span>
          <ArrowRight className="h-4 w-4 shrink-0 text-stone-400" />
        </Link>
      </div>

      {/* Local resources — single entry into the community resource explorer */}
      <div className="space-y-3">
        <p className="section-label mb-1">Community resources for you</p>
        <Link
          href="/resources"
          className="card-soft card-hover flex items-center justify-between p-4"
        >
          <span className="flex items-center gap-3">
            <Users className="h-5 w-5 text-teal-500" />
            <span>
              <span className="block text-sm font-semibold text-stone-900">Explore local resources</span>
              <span className="block text-xs text-stone-500">
                Food, housing, health, legal aid, and community orgs near you — plus a guide that
                helps you find the right one.
              </span>
            </span>
          </span>
          <ArrowRight className="h-4 w-4 text-stone-400" />
        </Link>
        <Link
          href="/petitions"
          className="card-soft card-hover flex items-center justify-between p-4"
        >
          <span className="flex items-center gap-3">
            <PenLine className="h-5 w-5 text-teal-500" />
            <span>
              <span className="block text-sm font-semibold text-stone-900">Petitions &amp; causes</span>
              <span className="block text-xs text-stone-500">
                Sign the local causes neighbors are organizing around.
              </span>
            </span>
          </span>
          <ArrowRight className="h-4 w-4 text-stone-400" />
        </Link>
      </div>

      {/* Notifications — a dev/verification tool. Hidden inside the native iOS
          app (real users shouldn't see a "test push" button); on web it stays so
          the push pipeline can still be triggered to a registered device. */}
      {!isNative && (
        <Show when="signed-in">
          <div className="rounded-2xl border border-stone-200 bg-white p-4">
            <p className="text-sm font-semibold text-stone-900">Notifications</p>
            <p className="mb-3 text-xs text-stone-500">Send yourself a test push to check it&apos;s working.</p>
            <PushTestButton />
          </div>
        </Show>
      )}

      {/* Account — explicit Log out (was only in the UserButton avatar menu, easy
          to miss) + Delete (an in-app deletion path is an App Store requirement). */}
      <Show when="signed-in">
        <div className="rounded-2xl border border-stone-200 bg-white p-4">
          <p className="text-sm font-semibold text-stone-900">Account</p>
          <p className="mb-3 text-xs text-stone-500">Manage your WhatsLocal account.</p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => signOut({ redirectUrl: "/" })}
              className="inline-flex items-center gap-1.5 rounded-full border border-stone-300 bg-white px-3.5 py-2 text-[13px] font-medium text-stone-700 transition hover:border-stone-400 hover:text-stone-900"
            >
              <LogOut className="h-4 w-4" /> Log out
            </button>
            <DeleteAccountButton />
          </div>
        </div>
      </Show>
    </div>
  );
}
