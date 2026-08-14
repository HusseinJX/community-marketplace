"use client";

import Link from "next/link";
import { Show, UserButton, useUser, useClerk } from "@clerk/nextjs";
import { LogOut } from "lucide-react";
import { TasteTuner } from "@/components/shopper/TasteTuner";
import { PushTestButton } from "@/components/PushTestButton";
import { DeleteAccountButton } from "@/components/account/DeleteAccountButton";
import { useLogin } from "@/components/auth/ClerkAuthProvider";
import { useIsNativeApp } from "@/lib/native";

// The shopper's personal space (parallel to the vendor portal). A signed-in
// vendor never reaches this — app/shopper/page.tsx redirects them to /vendor
// server-side — so this is the shopper/guest view only.
export function ShopperClient() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const openLogin = useLogin();
  const isNative = useIsNativeApp();


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
        <p className="mt-1 text-sm text-stone-500">Everything you&apos;ve saved, ordered, and discovered nearby.</p>
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

      {/* Signed IN — personalization, in place. It was a link to its own screen
          because it was the tallest thing on a crowded page; with the page
          emptied out, the extra tap is the only thing left to remove. Saved,
          Cart and Messages moved to the header menu and the tab bar, which is
          where you reach for them mid-browse anyway. */}
      <Show when="signed-in">
        <TasteTuner />
      </Show>

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
