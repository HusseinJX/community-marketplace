"use client";

import Link from "next/link";
import { Show, SignInButton, UserButton } from "@clerk/nextjs";
import { Heart, ShoppingBag, Receipt, Users, ArrowRight, PenLine } from "lucide-react";

// Demo shopper admin — the shopper's personal space (parallel to the vendor
// portal). Public/no-auth for demo so it's quickly testable and refinable.
export default function ShopperAdmin() {
  const cards = [
    { label: "Saved", value: "—", href: "/favorites", icon: Heart },
    { label: "Cart", value: "—", href: "/cart", icon: ShoppingBag },
    { label: "Orders", value: "—", href: "/favorites", icon: Receipt },
  ] as const;

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-10 md:px-8">
      {/* Account / sign-in */}
      <Show
        when="signed-out"
        fallback={
          <div className="flex items-center justify-end gap-2">
            <span className="text-sm text-stone-500">Account</span>
            <UserButton />
          </div>
        }
      >
        <div className="flex items-center justify-between rounded-2xl border border-stone-200 bg-white p-4">
          <div>
            <p className="text-sm font-semibold text-stone-900">Sign in to WhatsLocal</p>
            <p className="text-xs text-stone-500">Save places, track orders, get recommendations.</p>
          </div>
          <SignInButton mode="modal">
            <button className="shrink-0 rounded-full bg-stone-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-stone-800">
              Sign in
            </button>
          </SignInButton>
        </div>
      </Show>

      <div className="h-2 w-full rounded-full bg-gradient-to-r from-teal-400 to-sky-400" />

      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Your space</h1>
        <p className="mt-1 text-sm text-stone-500">Everything you&apos;ve saved, ordered, and discovered nearby.</p>
      </div>

      {/* Quick access — compact metric grid */}
      <div>
        <p className="section-label mb-3">Quick access</p>
        <div className="grid grid-cols-3 gap-2">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <Link
                key={card.label}
                href={card.href}
                className="card-soft card-hover flex flex-col items-center gap-1 p-3 text-center"
              >
                <Icon className="h-5 w-5 text-teal-500" />
                <span className="text-[11px] font-medium leading-tight text-stone-500">{card.label}</span>
                <span className="text-base font-semibold text-stone-900">{card.value}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Local resources — single entry into the community resource explorer */}
      <div className="space-y-3">
        <p className="section-label mb-1">Community resources for you</p>
        <Link
          href="/resources"
          className="card-soft card-hover flex items-center justify-between p-5"
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
          className="card-soft card-hover flex items-center justify-between p-5"
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
    </div>
  );
}
