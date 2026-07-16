'use client'

import { Children, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Package, ShoppingCart, Calendar, ArrowRight, UserCircle,
  MessageCircle, CreditCard, Radio, LifeBuoy, Heart,
} from 'lucide-react'
import { PLAN_KEY, PlanSwitch, type Tier } from '@/components/vendor/PlanSwitch'
import { CollabMatchHero } from '@/components/vendor/CollabMatchHero'
import { Opportunities } from '@/components/vendor/Opportunities'

// The vendor front door: who to team up with, and what's already looking for you.
// Everything else on this page is plumbing and sits below, in one list.
//
// Tier still gates what's shown, read from the plan (and whatever the shared
// preview switch last set). The switch is demo scaffolding — not the first thing
// a real business should see — so it's pinned at the BOTTOM of the page and only
// rendered in the admin demo (or for admins), never for a real signed-in vendor.

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

  // Collabs card: People (team-up matches) vs Events (opportunities to join).
  const [collabView, setCollabView] = useState<'people' | 'events'>('people')
  // For-you / Search mode — owned here so the tabs persist across People/Events.
  const [matchMode, setMatchMode] = useState<'for-you' | 'search'>('for-you')

  // The tier toggle is demo scaffolding — show it in the admin demo, or to admins.
  const showPlanSwitch = demo || isAdmin

  return (
    <>
      {/* ── The wedge, front and center. One "Collabs" section, two columns:
             people to team up with on one side, events to join on the other.
             Stacks on mobile. ────────────────────────────────────────────── */}
      {memberId ? (
        <div className="card-soft p-4 sm:p-5">
          {/* Title + a People / Events radio. People = who to team up with;
              Events = opportunities others are hosting that fit you. */}
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">Collabs</h2>
            <div className="inline-flex rounded-full bg-stone-100 p-0.5 text-[12px] font-medium">
              {(['people', 'events'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setCollabView(v)}
                  className={
                    'rounded-full px-3 py-1 capitalize transition ' +
                    (collabView === v ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700')
                  }
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          {/* For-you / Search tabs — owned here so they stay put when you flip
              People ↔ Events (Search only on tiers that can invite). */}
          <div className="mb-3 flex flex-wrap gap-1.5">
            {([['for-you', '✨ For you'], ...(canInvite ? [['search', '🔎 Search'] as const] : [])] as const).map(
              ([m, label]) => (
                <button
                  key={m}
                  onClick={() => setMatchMode(m)}
                  className={
                    'rounded-full px-3 py-1 text-sm font-medium transition ' +
                    (matchMode === m ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200')
                  }
                >
                  {label}
                </button>
              ),
            )}
          </div>

          {collabView === 'people' ? (
            <CollabMatchHero
              memberId={memberId}
              isAdmin={isAdmin}
              canInvite={canInvite}
              mode={matchMode}
              onModeChange={(m) => m !== 'similar' && setMatchMode(m)}
              hideTabs
            />
          ) : (
            // The retention lever — events others are hosting that fit you. Not
            // tier-gated: joining someone's lineup is supply, and we don't tax it.
            <Opportunities memberId={memberId} memberName={memberName} isAdmin={isAdmin} />
          )}
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
        {isPro && (
          <Section title="Pro tools">
            <Tile href="/vendor/products" Icon={Package} label="Products" desc="Your shop catalog" />
            <Tile
              href="/vendor/orders"
              Icon={ShoppingCart}
              label="Orders"
              desc={orderCount > 0 ? `${orderCount} to date` : 'No orders yet'}
            />
            <Tile href="/vendor/assistant" Icon={MessageCircle} label="Your agent" desc="Train your customer-service AI" />
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
