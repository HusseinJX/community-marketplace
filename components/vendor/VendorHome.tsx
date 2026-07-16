'use client'

import { Children, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Package, ShoppingCart, Calendar, ArrowRight, UserCircle,
  MessageCircle, CreditCard, Radio, LifeBuoy,
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
  const canCommerce = rank >= 2
  // The customer-service AI agent is a Pro capability (textAssistant).
  const canAgent = rank >= 2
  const isPro = rank >= 2

  // The tier toggle is demo scaffolding — show it in the admin demo, or to admins.
  const showPlanSwitch = demo || isAdmin

  return (
    <>
      {/* ── The wedge, front and center. One "Collabs" section, two columns:
             people to team up with on one side, events to join on the other.
             Stacks on mobile. ────────────────────────────────────────────── */}
      {memberId ? (
        <div className="card-soft p-4 sm:p-5">
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-stone-400">Collabs</h2>
          <div className="grid gap-6 lg:grid-cols-2">
            <CollabMatchHero memberId={memberId} isAdmin={isAdmin} canInvite={isPro} />
            {/* The retention lever — events others are hosting that fit you. Not
                tier-gated: joining someone's lineup is supply, and we don't tax it. */}
            <Opportunities memberId={memberId} memberName={memberName} isAdmin={isAdmin} />
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

      {/* ── Everything else: grouped so the dashboard reads as sections, not a
             wall of equal tiles. Rows the current tier can't use aren't shown,
             and a group with nothing left in it drops its heading too. */}
      <div className="space-y-6">
        <Section title="Run">
          <Tile href="/vendor/events" Icon={Calendar} label="My events" desc="Host events + collect RSVPs" />
          <Tile href="/share?vendor=1" Icon={Radio} label="Post / Go live" desc="Share an update or broadcast live" />
        </Section>

        <Section title="Sell">
          {canCommerce && <Tile href="/vendor/products" Icon={Package} label="Products" />}
          {canCommerce && (
            <Tile
              href="/vendor/orders"
              Icon={ShoppingCart}
              label="Orders"
              desc={orderCount > 0 ? `${orderCount} to date` : 'No orders yet'}
            />
          )}
        </Section>

        <Section title="Tools">
          {canAgent && <Tile href="/vendor/assistant" Icon={MessageCircle} label="Your agent" desc="Train your customer-service AI" />}
          {/* Moved out of the top nav — useful, but not the wedge. */}
          <Tile href="/vendor/resources" Icon={LifeBuoy} label="Resources" desc="Grants, permits & local programs" />
        </Section>

        <Section title="Account">
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
