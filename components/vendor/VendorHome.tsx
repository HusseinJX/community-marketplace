'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CollabMatchHero } from '@/components/vendor/CollabMatchHero'
import { Opportunities } from '@/components/vendor/Opportunities'
import { UpcomingCollabs, useUpcomingCollabs } from '@/components/vendor/ActiveCollabs'
import { MyLineups } from '@/components/vendor/MyLineups'
// Kept while its render block is commented out below — deleting it would make
// restoring the feature a two-file change instead of uncommenting one block.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { EventLinkImport } from '@/components/vendor/EventLinkImport'

// The vendor front door: who to team up with, and what's already looking for you.
// Everything else on this page is plumbing and sits below, in one list.
//
// Tier still gates what's shown, read from the account's real plan.

// Upcoming leads: what you're already committed to, before anything to discover.
type CollabView = 'upcoming' | 'join' | 'create'

// The whole Collabs section is HIDDEN for now — flip to `true` to restore it.
// Every render branch below is left intact (same as the Create/Join tabs and
// the event-link import above it), so this is the only edit either way.
//
// Typed `boolean` rather than left as the literal `false` on purpose: a literal
// makes TypeScript treat the branch as unreachable and stop narrowing `memberId`
// inside it, which is what broke the build the last time something here was
// switched off with a bare `false &&`.
const SHOW_COLLABS: boolean = false

/**
 * The four things a vendor came here to do: their shop, their posts, their
 * events, their page.
 *
 * Everything below this grid is plumbing — orders, payouts, billing, the
 * neighbourhood tools — and it stays reachable, but it stopped being the first
 * thing on the screen. A dashboard that opens with fourteen equal tiles asks
 * the vendor to read a menu before doing anything; these four are the menu.
 */
// Tile + Section (the dashboard's own grouped list) were deleted with the list
// itself — the hub pages use components/vendor/HubTile, which is the same row
// in one place. Restore from git if the grouped dashboard ever comes back.

export function VendorHome({
  plan, memberId, memberName = 'A local business', isAdmin = false, demo = false, children,
}: {
  // Only the tier switch reads this now — the order count and the plan LABEL
  // moved to the hub pages that show them (/vendor/shop, /vendor/profile),
  // which took a Stripe account lookup and an orders fetch off every dashboard
  // load with them.
  plan: string
  // Null until a member profile is linked — the matcher needs a member to seed
  // complementary matches from, so we fall back to a static CTA card.
  memberId?: string | null
  memberName?: string
  isAdmin?: boolean
  // The admin demo leads with a demo intro strip, hidden for a real vendor.
  demo?: boolean
  // The dashboard's main content (the shop: Products | Sales), placed between
  // the section row and the collab/lineup blocks.
  children?: React.ReactNode
}) {
  // The account's REAL plan, and nothing else. There used to be a Free/Basic/Pro
  // preview switch (admins + demo) whose pick lived in localStorage and
  // OVERRODE this — removed 2026-09-29, including the override, so a stale
  // pick can't leave anyone looking at a tier they don't have.
  const tier = plan === 'member' ? 'member' : plan === 'free' ? 'free' : 'pro'

  const rank = tier === 'pro' ? 2 : tier === 'member' ? 1 : 0
  // Sending collab invites is a Basic (Member+) capability; Pro is shop + agent.
  const canInvite = rank >= 1

  // Collabs card: Upcoming (what you're already in) | Join (opportunities others
  // host) | Create (start one). Upcoming leads and is the default — commitments
  // before discovery.
  const [collabView, setCollabView] = useState<CollabView>('upcoming')

  // Upcoming self-hides when you're in nothing: no tab, and the card falls back
  // to Join, exactly as the dashboard behaved before this tab existed. Derived
  // rather than an effect, so it settles the moment the data lands and never
  // fights a choice the vendor has actually made.
  const upcoming = useUpcomingCollabs(memberId, !!isAdmin)
  // Unused while the Join tab is hidden; it decides the default tab once the
  // tab list has more than one entry again.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const hasUpcoming = upcoming.length > 0
  // "Create" and "Join" ("Opportunities near you") are hidden for now. Every
  // render branch below stays in place, so restoring either is one entry here.
  const tabs: CollabView[] = ['upcoming']
  // Fall back to the first VISIBLE tab rather than naming one, so hiding a tab
  // can never strand the panel on a view with no control to leave it.
  const view: CollabView = tabs.includes(collabView) ? collabView : tabs[0]

  return (
    <>
      {/* Paste an event link → add it to your events (real vendors only).
          HIDDEN FOR NOW — uncomment to restore. Commented rather than `false &&`
          because that form keeps TypeScript from narrowing `memberId` and the
          block stops compiling.

      {memberId && !demo && (
        <div className="mb-6">
          <EventLinkImport memberId={memberId} memberName={memberName} isAdmin={isAdmin} />
        </div>
      )}
      */}

      {/* The section tile row is gone (2026-09-29): Products · Sales · Events ·
          Messages are pills at the top of `children` (DashboardShop), and Tools
          / Profile sit behind the gear beside "+ Post". */}
      {children}

      {/* data-vendor-nav: everything below the dashboard's content steps
          aside while a Messages conversation is open (globals.css), so the
          chat keeps the full height it is sized to. */}
      <div data-vendor-nav className="contents">

      {/* Commitments before discovery: an event you already said yes to
          outranks anything you might browse. Self-hides when you're on none. */}
      <MyLineups memberId={memberId ?? undefined} />

      {/* ── The wedge, front and center. One "Collabs" section, two columns:
             people to team up with on one side, events to join on the other.
             Stacks on mobile. ────────────────────────────────────────────── */}
      {!SHOW_COLLABS ? null : memberId ? (
        <div>
          {/* Title + the Upcoming / Join / Create toggle, above the card. (The
              For-you/Search tabs are gone — the composer has its own search bar,
              and Create opens on ideas.) */}
          <div className="mb-2 flex flex-wrap items-center gap-3">
            <h2 className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">Collabs</h2>
            {/* A switcher with one option is decoration — don't render it until
                there is a choice to make. NOT a `hidden` class: that conflicts
                with `inline-flex` on the same element and loses, because
                competing display utilities are resolved by stylesheet order
                rather than the order they appear in the class list. */}
            {tabs.length > 1 && (
            <div className="inline-flex rounded-full bg-stone-100 p-0.5 text-[12px] font-medium">
              {tabs.map((v) => (
                <button
                  key={v}
                  onClick={() => setCollabView(v)}
                  className={
                    'rounded-full px-3 py-1 capitalize transition ' +
                    (view === v ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700')
                  }
                >
                  {v}
                </button>
              ))}
            </div>
            )}
          </div>

          <div className="card-soft p-4 sm:p-5">
          {view === 'upcoming' ? (
            // The collaborations you're already in. Same cards as the rail that
            // used to sit above this card — this tab replaced it.
            <UpcomingCollabs memberId={memberId} isAdmin={!!isAdmin} />
          ) : view === 'create' ? (
            <CollabMatchHero memberId={memberId} isAdmin={isAdmin} canInvite={canInvite} demo={demo} />
          ) : (
            // The retention lever — events others are hosting that fit you. Not
            // tier-gated: joining someone's lineup is supply, and we don't tax it.
            <Opportunities memberId={memberId} memberName={memberName} isAdmin={isAdmin} showEmpty />
          )}
          </div>
        </div>
      ) : (
        <div className="card-soft p-4">
          <p className="text-[15px] font-semibold text-stone-900">Team up</p>
          <p className="mt-1 text-[13px] leading-snug text-stone-600">
            Link your business to see the local partners we match you with.
          </p>
          <Link
            href="/vendor/setup"
            className="mt-3 inline-flex rounded-full bg-stone-900 px-3.5 py-2 text-[13px] font-semibold text-white transition hover:bg-stone-800"
          >
            Link your business
          </Link>
        </div>
      )}

      {/* Everything that used to be listed here now lives behind one of the
          six buttons above:
            Products / Orders / Integrations  → /vendor/shop
            Edit profile / Plan & billing     → /vendor/profile
            Your agent / Giving / Resources   → /vendor/tools
            My events                         → the Events button
            Post / Go live                    → the Posts button
          Petitions is HIDDEN for vendors (2026-08-22) — it is a shopper
          surface, still live at /petitions, and it was the one tile here that
          asked a business owner to go and be a citizen while they were trying
          to run a shop. */}

      </div>
    </>
  )
}
