"use client";

import Link from "next/link";
import { Show, useUser, useClerk } from "@clerk/nextjs";
import { LogOut, PenLine, ArrowRight, Receipt, Settings, LifeBuoy, BadgeCheck, ListPlus } from "lucide-react";
import { DeleteAccountButton } from "@/components/account/DeleteAccountButton";
import { useLogin } from "@/components/auth/ClerkAuthProvider";

// The shopper's personal space (parallel to the vendor portal). A signed-in
// vendor never reaches this — app/shopper/page.tsx redirects them to /vendor
// server-side — so this is the shopper/guest view only.
export function ShopperClient() {
  const { user } = useUser();
  const { signOut, openUserProfile } = useClerk();
  const openLogin = useLogin();


  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 md:px-8">

      {/* The name + Clerk `UserButton` that used to sit in this corner are
          gone. It put a second, differently-shaped account menu on a page that
          already has an Account card, and everything it offered — who you are,
          manage, log out — now lives in that one card where the destructive
          action can be kept at a distance from the harmless ones. */}

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

      {/* Memberships — the businesses this person pays every month. Signed-in
          only: a membership renews, so it belongs to an account, not a device.
          Sits with Orders — both are things you already hold, as opposed to the
          two community cards below, which are things to go and do. */}
      <Show when="signed-in">
        <Link href="/shopper/memberships" className="card-soft card-hover flex items-center justify-between p-4">
          <span className="flex items-center gap-3">
            <BadgeCheck className="h-5 w-5 shrink-0 text-teal-500" />
            <span>
              <span className="block t-strong text-stone-900">Memberships</span>
              <span className="block t-meta text-stone-500">
                The local businesses you support, and the perks that come with it.
              </span>
            </span>
          </span>
          <ArrowRight className="h-4 w-4 shrink-0 text-stone-400" />
        </Link>
      </Show>

      <Show when="signed-in">
        <Link href="/shopper/lists" className="card-soft card-hover flex items-center justify-between p-4">
          <span className="flex items-center gap-3">
            <ListPlus className="h-5 w-5 shrink-0 text-teal-500" />
            <span>
              <span className="block t-strong text-stone-900">My lists</span>
              <span className="block t-meta text-stone-500">
                Shops you saved into your own plans, errands, and places to try.
              </span>
            </span>
          </span>
          <ArrowRight className="h-4 w-4 shrink-0 text-stone-400" />
        </Link>
      </Show>

      {/* Local resources — the single entry into the community resource
          explorer. Unhidden: /resources is a real, populated screen and this
          page is the only route to it for a shopper. */}
      <Link href="/resources" className="card-soft card-hover flex items-center justify-between p-4">
        <span className="flex items-center gap-3">
          <LifeBuoy className="h-5 w-5 shrink-0 text-teal-500" />
          <span>
            <span className="block t-strong text-stone-900">Local resources</span>
            <span className="block t-meta text-stone-500">
              Food, housing, health, legal aid and community orgs near you — plus a guide that
              helps you find the right one.
            </span>
          </span>
        </span>
        <ArrowRight className="h-4 w-4 shrink-0 text-stone-400" />
      </Link>

      {/* Petitions — back after the strip-down. It is the one community
          surface that belongs on a person's own page rather than in browse:
          signing a local cause is something you do as yourself. */}
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

      {/* Account — the one place the account is handled. Who you are, then the
          two everyday actions (Manage, Log out), then deletion.
          Deletion is deliberately NOT in that row: it used to sit inline
          beside Log out, one small gap from a button people press often, and
          the two are not the same kind of thing at all — one you do weekly and
          undo by logging back in, the other is permanent. It gets a rule above
          it, its own warning line, and no button shape shared with its
          neighbours, so reaching it has to be on purpose.
          The in-app deletion path itself is an App Store requirement (5.1.1(v))
          and must stay reachable. */}
      <Show when="signed-in">
        <div className="rounded-2xl border border-stone-200 bg-white">
          <div className="p-4">
            <p className="text-sm font-semibold text-stone-900">Account</p>

            {/* Who you're signed in as — the job the avatar in the corner used
                to do, said in words rather than as a menu. */}
            <div className="mt-3 flex items-center gap-3">
              {user?.imageUrl && (
                // Clerk's CDN avatar. A plain <img>, not next/image: the host
                // isn't in lib/image-hosts.ts and a 40px avatar is not worth
                // adding a remote pattern for.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.imageUrl}
                  alt=""
                  className="h-10 w-10 shrink-0 rounded-full object-cover ring-1 ring-stone-200"
                />
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-stone-900">
                  {user?.fullName || user?.firstName || "Signed in"}
                </p>
                {user?.primaryEmailAddress?.emailAddress && (
                  <p className="truncate text-xs text-stone-500">
                    {user.primaryEmailAddress.emailAddress}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              {/* Clerk's account modal, opened by us — same screen the avatar
                  menu led to, reached from a button that says what it does. */}
              <button
                type="button"
                onClick={() => openUserProfile()}
                className="inline-flex items-center gap-1.5 rounded-full bg-stone-900 px-3.5 py-2 text-[13px] font-semibold text-white transition hover:bg-stone-800"
              >
                <Settings className="h-4 w-4" /> Manage account
              </button>
              <button
                type="button"
                onClick={() => signOut({ redirectUrl: "/" })}
                className="inline-flex items-center gap-1.5 rounded-full border border-stone-300 bg-white px-3.5 py-2 text-[13px] font-medium text-stone-700 transition hover:border-stone-400 hover:text-stone-900"
              >
                <LogOut className="h-4 w-4" /> Log out
              </button>
            </div>
          </div>

          {/* Below the rule: the permanent one. */}
          <div className="border-t border-stone-200 px-4 py-3">
            <p className="text-xs text-stone-500">
              Deleting removes your account and personal data permanently.
            </p>
            <div className="mt-2">
              <DeleteAccountButton />
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}
