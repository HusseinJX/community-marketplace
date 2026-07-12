'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Package, ShoppingCart, Calendar, ArrowRight, UserCircle,
  MessageCircle, Heart, CreditCard, Radio, Users, CalendarPlus, Sparkles,
} from 'lucide-react'
import { PlanSwitch, PLAN_KEY, type Tier } from '@/components/vendor/PlanSwitch'

// Free / Basic / Pro gate the dashboard sections (replaces the old commerce
// toggle). The switch shares state with the collab page via PLAN_KEY.

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
  orderCount, plan, planLabel,
}: { orderCount: number; plan: string; planLabel: string }) {
  const initial: Tier = plan === 'member' ? 'member' : plan === 'free' ? 'free' : 'pro'
  const [tier, setTier] = useState<Tier>(initial)

  useEffect(() => {
    const v = localStorage.getItem(PLAN_KEY)
    if (v === 'free' || v === 'member' || v === 'pro') setTier(v)
  }, [])

  function pick(t: Tier) {
    setTier(t)
    localStorage.setItem(PLAN_KEY, t)
  }

  // Every tier shows the SAME cards; lower tiers just see the gated ones hidden.
  const rank = tier === 'pro' ? 2 : tier === 'member' ? 1 : 0
  const needsPro = rank < 2   // commerce (Products / Orders)
  const needsBasic = rank < 1 // Agent
  const isPro = rank >= 2
  // Events are self-hosted and available to EVERY tier (create/edit + RSVP, no
  // collaboration/lineup — that lives in the Collabs tab, gated separately).
  // Collabs + Resources are top-nav tabs (gated there), not dashboard buttons.

  const metrics = [
    { label: 'Products', value: '3', href: '/vendor/products', icon: Package, locked: needsPro },
    { label: 'Orders', value: orderCount > 0 ? String(orderCount) : '—', href: '/vendor/orders', icon: ShoppingCart, locked: needsPro },
    { label: 'Events', value: '—', href: '/vendor/events', icon: Calendar, locked: false },
  ]
  const quickAccess = metrics.filter((card) => !card.locked)
  // Free/Basic have room in Quick access (commerce cards hidden) — surface the
  // profile editor there. On Pro it lives under Plan & billing instead.
  if (!isPro) {
    quickAccess.push({ label: 'Profile', value: 'Edit', href: '/vendor/about', icon: UserCircle, locked: false })
  }

  return (
    <>
      {/* Plan switch — gates everything below (shared with the collab page) */}
      <PlanSwitch tier={tier} onPick={pick} caption="Preview each tier — gates the features below." />

      {/* ── The wedge, front and center ─────────────────────────────────────
          Collaboration-for-events is what this app is for, so it leads the
          dashboard instead of hiding in the Collabs tab. */}
      <div className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-violet-50 p-4">
        <div className="flex items-center gap-2 text-indigo-700">
          <Sparkles className="h-4 w-4" />
          <p className="text-[11px] font-semibold uppercase tracking-wide">Build your next event</p>
        </div>
        <p className="mt-1.5 text-[15px] font-semibold leading-snug text-stone-900">
          Team up with complementary local businesses.
        </p>
        <p className="mt-1 text-[13px] leading-snug text-stone-600">
          We match you by what you offer and need — a coffee roaster to your bakery, a muralist for
          your launch — then help you plan it together.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href="/vendor/network"
            className="inline-flex items-center gap-1.5 rounded-full bg-indigo-600 px-3.5 py-2 text-[13px] font-semibold text-white transition hover:bg-indigo-700"
          >
            <Users className="h-4 w-4" /> Find collaborators
          </Link>
          <Link
            href="/vendor/organize"
            className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-white px-3.5 py-2 text-[13px] font-semibold text-indigo-700 transition hover:border-indigo-300"
          >
            <CalendarPlus className="h-4 w-4" /> Host an event
          </Link>
        </div>
      </div>

      {/* Quick access — cards the current tier can't access are hidden entirely
          (not shown greyed out). */}
      <div>
        <p className="section-label mb-3">Quick access</p>
        <div className="grid grid-cols-3 gap-2">
          {quickAccess.map((card) => {
            const Icon = card.icon
            return (
              <Link key={card.label} href={card.href} className="card-soft card-hover flex flex-col items-center gap-1 p-3 text-center">
                <Icon className="h-5 w-5 text-indigo-500" />
                <span className="text-[11px] font-medium leading-tight text-stone-500">{card.label}</span>
                <span className="text-base font-semibold text-stone-900">{card.value}</span>
              </Link>
            )
          })}
        </div>
      </div>

      {/* Manage — tiles the current tier can't access are hidden entirely. */}
      <div className="grid gap-3 sm:grid-cols-2">
        {!needsPro && <Tile href="/vendor/products" Icon={Package} label="My Products" />}
        <Tile href="/vendor/events" Icon={Calendar} label="My Events" desc="Host events + collect RSVPs" />
        <Tile href="/share?vendor=1" Icon={Radio} label="Post / Go live" desc="Share an update or broadcast live" />
      </div>

      {/* Tools (QR moved to the title button; Collabs/Resources live in the top nav) */}
      <div>
        <p className="section-label mb-3">Tools</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {!needsBasic && <Tile href="/vendor/assistant" Icon={MessageCircle} label="Your agent" desc="Train your customer-service AI" />}
          <Tile href="/vendor/giving" Icon={Heart} label="Giving" desc="Log community contributions" />
          <Tile href="/vendor/billing" Icon={CreditCard} label="Plan & billing" desc={`Current plan: ${planLabel}`} />
          {/* Pro surfaces the profile editor here (Free/Basic get it in Quick access). */}
          {isPro && <Tile href="/vendor/about" Icon={UserCircle} label="Business profile" desc="Edit your bio, category & links" />}
        </div>
      </div>
    </>
  )
}
