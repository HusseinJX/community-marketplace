'use client'

import { Children, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Package, ShoppingCart, Calendar, ArrowRight, UserCircle,
  MessageCircle, CreditCard, Radio, LifeBuoy, Heart, Plug,
} from 'lucide-react'
import { PLAN_KEY, PlanSwitch, type Tier } from '@/components/vendor/PlanSwitch'
import { CollabMatchHero } from '@/components/vendor/CollabMatchHero'
import { Opportunities } from '@/components/vendor/Opportunities'
import { UpcomingCollabs, useUpcomingCollabs } from '@/components/vendor/ActiveCollabs'
import { useIsNativeApp } from '@/lib/native'

// The vendor front door: who to team up with, and what's already looking for you.
// Everything else on this page is plumbing and sits below, in one list.
//
// Tier still gates what's shown, read from the plan (and whatever the shared
// preview switch last set). The switch is demo scaffolding — not the first thing
// a real business should see — so it's pinned at the BOTTOM of the page and only
// rendered in the admin demo (or for admins), never for a real signed-in vendor.

// Upcoming leads: what you're already committed to, before anything to discover.
type CollabView = 'upcoming' | 'join' | 'create'

function Tile({ href, Icon, label, desc }: { href: string; Icon: typeof Package; label: string; desc?: string }) {
  return (
    <Link href={href} className="card-soft card-hover flex items-center justify-between p-4">
      <span className="flex items-center gap-3">
        <Icon className="h-5 w-5 text-indigo-500" />
        <span>
          <span className="block text-sm font-semibold text-stone-900">{label}</span>
          {desc && <span className="block text-xs text-stone-500">{desc}</span>}
        </span>
      </span>
      <ArrowRight className="h-4 w-4 text-stone-400" />
    </Link>
  )
}

// A labelled group of tiles. Kept out of the render when it has no visible
// children so a tier that hides every tile in a group hides the heading too.
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const items = Children.toArray(children).filter(Boolean)
  if (items.length === 0) return null
  return (
    <div>
      <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-stone-400">{title}</h2>
      <div className="grid gap-3 sm:grid-cols-2">{items}</div>
    </div>
  )
}

export function VendorHome({
  orderCount, plan, planLabel, memberId, memberName = 'A local business', isAdmin = false, demo = false,
}: {
  orderCount: number
  plan: string
  planLabel: string
  // Null until a member profile is linked — the matcher needs a member to seed
  // complementary matches from, so we fall back to a static CTA card.
  memberId?: string | null
  memberName?: string
  isAdmin?: boolean
  // In the admin demo we lead with a demo intro strip and expose the tier
  // preview switch at the bottom — both hidden for a real signed-in vendor.
  demo?: boolean
}) {
  const initial: Tier = plan === 'member' ? 'member' : plan === 'free' ? 'free' : 'pro'
  const [tier, setTier] = useState<Tier>(initial)
  const native = useIsNativeApp() // iOS: no subscription price/upsell (Apple 3.1.1)

  useEffect(() => {
    const v = localStorage.getItem(PLAN_KEY)
    if (v === 'free' || v === 'member' || v === 'pro') setTier(v)
  }, [])

  // The preview switch writes the shared key so every collab surface inherits it.
  const pickTier = (t: Tier) => {
    setTier(t)
    try { localStorage.setItem(PLAN_KEY, t) } catch { /* private mode */ }
  }

  const rank = tier === 'pro' ? 2 : tier === 'member' ? 1 : 0
  const isPro = rank >= 2
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
  const hasUpcoming = upcoming.length > 0
  const view: CollabView = collabView === 'upcoming' && !hasUpcoming ? 'join' : collabView
  const tabs: CollabView[] = hasUpcoming ? ['upcoming', 'join', 'create'] : ['join', 'create']

  // The tier toggle is demo scaffolding — show it in the admin demo, or to admins.
  const showPlanSwitch = demo || isAdmin

  return (
    <>
      {/* ── The wedge, front and center. One "Collabs" section, two columns:
             people to team up with on one side, events to join on the other.
             Stacks on mobile. ────────────────────────────────────────────── */}
      {memberId ? (
        <div>
          {/* Title + the Upcoming / Join / Create toggle, above the card. (The
              For-you/Search tabs are gone — the composer has its own search bar,
              and Create opens on ideas.) */}
          <div className="mb-2 flex flex-wrap items-center gap-3">
            <h2 className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">Collabs</h2>
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

      {/* ── Everything else: grouped. Pro tools lead when the tier is Pro; then
             the things you touch often; then the tools you dip into. Tier-hidden
             tiles drop out and an empty group drops its heading too. */}
      <div className="space-y-6">
        {/* Pro is shop + agent — its own group, shown only on Pro, above the rest. */}
        {isPro ? (
          <Section title="Pro tools">
            <Tile href="/vendor/products" Icon={Package} label="Products" desc="Your shop catalog" />
            <Tile
              href="/vendor/orders"
              Icon={ShoppingCart}
              label="Orders"
              desc={orderCount > 0 ? `${orderCount} to date` : 'No orders yet'}
            />
            <Tile href="/vendor/assistant" Icon={MessageCircle} label="Your agent" desc="Train your customer-service AI" />
            {/* One home for the external hookups: shop catalog, delivery, and
                the payout bank account. Was two tiles (Shop & delivery + Payouts)
                pointing at two pages; consolidated into /vendor/integrations. */}
            <Tile href="/vendor/integrations" Icon={Plug} label="Integrations" desc="Shop, delivery & bank payouts" />
          </Section>
        ) : native ? null : (
          // Off Pro, the shop tools simply vanished — no mention, no price, no way
          // through. The paywall was behind a door that didn't exist.
          // (Hidden entirely in the iOS app — Apple 3.1.1 forbids the price + CTA.)
          <Section title="Sell on WhatsLocal">
            <div className="card-soft p-4 sm:col-span-2">
              <p className="text-[15px] font-semibold text-stone-900">Open your shop</p>
              <p className="mt-1 text-[13px] leading-snug text-stone-600">
                Sync your Shopify or Square catalog, take payments, and offer delivery.
                Pro is $30/mo — we take 5% of each sale, and nothing when you don&apos;t sell.
              </p>
              <Link
                href="/vendor/billing"
                className="mt-3 inline-flex rounded-full bg-stone-900 px-3.5 py-2 text-[13px] font-semibold text-white transition hover:bg-stone-800"
              >
                See plans
              </Link>
            </div>
          </Section>
        )}

        <Section title="Quick access">
          {/* Creating/hosting events is a Basic ($10/mo) capability. */}
          {canInvite && (
            <Tile href="/vendor/events" Icon={Calendar} label="My events" desc="Host events + collect RSVPs" />
          )}
          <Tile href="/share?vendor=1" Icon={Radio} label="Post / Go live" desc="Share an update or broadcast live" />
        </Section>

        <Section title="Tools">
          <Tile href="/vendor/giving" Icon={Heart} label="Giving" desc="Log a gift to a local org" />
          {/* Moved out of the top nav — useful, but not the wedge. */}
          <Tile href="/vendor/resources" Icon={LifeBuoy} label="Resources" desc="Grants, permits & local programs" />
          <Tile href="/vendor/about" Icon={UserCircle} label="Business profile" desc="Edit your bio, category & links" />
          <Tile href="/vendor/billing" Icon={CreditCard} label="Plan & billing" desc={`Current plan: ${planLabel}`} />
        </Section>
      </div>

      {/* Tier preview — pinned at the bottom (demo scaffolding). Flips what the
          whole dashboard shows; the shared key carries it to the collab surfaces. */}
      {showPlanSwitch && (
        <div className="mt-2">
          <PlanSwitch tier={tier} onPick={pickTier} caption="Preview what each tier unlocks." />
        </div>
      )}
    </>
  )
}
