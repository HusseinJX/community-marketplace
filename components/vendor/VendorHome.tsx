'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Package, ShoppingCart, Calendar, ArrowRight, UserCircle,
  MessageCircle, CreditCard, Radio, LifeBuoy,
} from 'lucide-react'
import { PLAN_KEY, type Tier } from '@/components/vendor/PlanSwitch'
import { CollabMatchHero } from '@/components/vendor/CollabMatchHero'
import { Opportunities } from '@/components/vendor/Opportunities'

// The vendor front door: who to team up with, and what's already looking for you.
// Everything else on this page is plumbing and sits below, in one list.
//
// Tier still gates what's shown, but it's read from the plan (and whatever the
// shared preview switch on the collab page last set) — the switch itself is NOT
// rendered here: a tier toggle is demo scaffolding, not the first thing a real
// business should see when they open their business.

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

export function VendorHome({
  orderCount, plan, planLabel, memberId, memberName = 'A local business', isAdmin = false,
}: {
  orderCount: number
  plan: string
  planLabel: string
  // Null until a member profile is linked — the matcher needs a member to seed
  // complementary matches from, so we fall back to a static CTA card.
  memberId?: string | null
  memberName?: string
  isAdmin?: boolean
}) {
  const initial: Tier = plan === 'member' ? 'member' : plan === 'free' ? 'free' : 'pro'
  const [tier, setTier] = useState<Tier>(initial)

  useEffect(() => {
    const v = localStorage.getItem(PLAN_KEY)
    if (v === 'free' || v === 'member' || v === 'pro') setTier(v)
  }, [])

  const rank = tier === 'pro' ? 2 : tier === 'member' ? 1 : 0
  const canCommerce = rank >= 2
  const canAgent = rank >= 1
  const isPro = rank >= 2

  return (
    <>
      {/* ── The wedge, front and center ───────────────────────────────────── */}
      {memberId ? (
        <>
          <CollabMatchHero memberId={memberId} isAdmin={isAdmin} canInvite={isPro} />
          {/* The retention lever — events others are hosting that fit you. Not
              tier-gated: joining someone's lineup is supply, and we don't tax it. */}
          <Opportunities memberId={memberId} memberName={memberName} isAdmin={isAdmin} />
        </>
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

      {/* ── Everything else: one list, no sub-headings, no metric tiles.
             Rows the current tier can't use aren't shown. */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Tile href="/vendor/events" Icon={Calendar} label="My events" desc="Host events + collect RSVPs" />
        <Tile href="/share?vendor=1" Icon={Radio} label="Post / Go live" desc="Share an update or broadcast live" />
        {canCommerce && <Tile href="/vendor/products" Icon={Package} label="Products" />}
        {canCommerce && (
          <Tile
            href="/vendor/orders"
            Icon={ShoppingCart}
            label="Orders"
            desc={orderCount > 0 ? `${orderCount} to date` : 'No orders yet'}
          />
        )}
        {canAgent && <Tile href="/vendor/assistant" Icon={MessageCircle} label="Your agent" desc="Train your customer-service AI" />}
        <Tile href="/vendor/about" Icon={UserCircle} label="Business profile" desc="Edit your bio, category & links" />
        {/* Moved out of the top nav — useful, but not the wedge. */}
        <Tile href="/vendor/resources" Icon={LifeBuoy} label="Resources" desc="Grants, permits & local programs" />
        <Tile href="/vendor/billing" Icon={CreditCard} label="Plan & billing" desc={`Current plan: ${planLabel}`} />
      </div>
    </>
  )
}
