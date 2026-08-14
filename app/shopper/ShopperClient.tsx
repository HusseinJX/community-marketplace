"use client";

import Link from "next/link";
import { Show, UserButton, useUser, useClerk } from "@clerk/nextjs";
import { LogOut, PenLine, ArrowRight, Receipt } from "lucide-react";
import { DeleteAccountButton } from "@/components/account/DeleteAccountButton";
import { useLogin } from "@/components/auth/ClerkAuthProvider";

// The shopper's personal space (parallel to the vendor portal). A signed-in
// vendor never reaches this — app/shopper/page.tsx redirects them to /vendor
// server-side — so this is the shopper/guest view only.
export function ShopperClient() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const openLogin = useLogin();


  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 md:px-8">

      {/* Signed in: name + avatar. Signed out: nothing here — the whole
          screen IS the login prompt below, and a second entry point in the
          corner would be two doors to one room. The "Vendor login" button that
          used to sit on the left is gone from here too: vendors reach their
          portal from "Join as a vendor" in the header, and offering a second
          account type on the shopper's own page only invites signing in as the
          wrong one. */}
      <Show when="signed-out" fallback={
        <div className="flex items-center justify-end gap-2">
          <span className="max-w-[8rem] truncate text-sm font-medium text-stone-700">
            {user?.firstName || user?.fullName || user?.primaryEmailAddress?.emailAddress}
          </span>
          <UserButton />
        </div>
      }>
        <></>
      </Show>

      {/* Title */}
      <div>
        <h1 className="text-xl font-semibold text-stone-900">Your space</h1>
        <p className="mt-1 t-meta text-stone-500">Your orders, the causes you back, and your account.</p>
      </div>

      {/* Signed OUT — the login, and nothing else. This page used to open on
          Quick access tiles, Messages, personalization, starred rooms and two
          community sections, none of which a signed-out visitor can use. */}
      <Show when="signed-out">
        <div className="card-soft p-6 text-center">
          <p className="t-lead text-stone-900">Log in to your space</p>
          <p className="mt-1 t-meta text-stone-500">
            Your saved places, tickets and orders, on any device.
          </p>
          <button
            onClick={() => openLogin({ redirectUrl: "/shopper" })}
            className="mt-4 inline-flex items-center justify-center rounded-full bg-stone-900 px-5 py-2.5 t-meta font-semibold text-white transition hover:bg-stone-800"
          >
            Log in or sign up
          </button>
        </div>
      </Show>

      {/* The personalization panel is hidden here. It still lives on its own
          screen at /shopper/personalization, which works signed-out too — this
          page is now about what you HAVE (orders, causes, account) rather than
          about tuning what you see. */}

      {/* Orders. Points at /tickets because that is the only place a shopper
          can currently see what they bought — there is no dedicated orders
          page yet, and a card linking to a 404 is worse than no card. Repoint
          this the moment one exists. */}
      <Show when="signed-in">
        <Link href="/tickets" className="card-soft card-hover flex items-center justify-between p-4">
          <span className="flex items-center gap-3">
            <Receipt className="h-5 w-5 shrink-0 text-teal-500" />
            <span>
              <span className="block t-strong text-stone-900">Orders</span>
              <span className="block t-meta text-stone-500">
                Tickets and purchases from local businesses.
              </span>
            </span>
          </span>
          <ArrowRight className="h-4 w-4 shrink-0 text-stone-400" />
        </Link>
      </Show>

      {/* Petitions — back after the strip-down. It is the one community
          surface that belongs on a person's own page rather than in browse:
          signing a local cause is something you do as yourself, and there is
          no other route to it now that the resources section is gone. */}
      <Link href="/petitions" className="card-soft card-hover flex items-center justify-between p-4">
        <span className="flex items-center gap-3">
          <PenLine className="h-5 w-5 shrink-0 text-teal-500" />
          <span>
            <span className="block t-strong text-stone-900">Petitions &amp; causes</span>
            <span className="block t-meta text-stone-500">
              Sign the local causes neighbors are organizing around.
            </span>
          </span>
        </span>
        <ArrowRight className="h-4 w-4 shrink-0 text-stone-400" />
      </Link>

      {/* Notifications test card removed — it was a dev tool sitting on a
          real person's account page, offering to send them a push for no
          reason they could act on. The push pipeline is still triggerable from
          the vendor side; PushTestButton itself is untouched. */}

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
