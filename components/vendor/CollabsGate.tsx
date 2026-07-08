'use client'

import { cloneElement, isValidElement, useEffect, useState } from 'react'
import Link from 'next/link'
import { Info } from 'lucide-react'
import { PlanSwitch, PLAN_KEY, type Tier } from '@/components/vendor/PlanSwitch'

// Gates the Collabs surface. On Free the member gets the SAME interactive UI as
// Basic — they can click around, switch tabs, browse matches — with a demo banner
// making clear it's a preview and real actions need an upgrade. Basic+ drops the
// banner. The tier switch shares state with the dashboard (same localStorage key).

function DemoBanner() {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
      <Info className="h-5 w-5 shrink-0 text-amber-600" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-amber-900">Demo — look around, actions need Basic</p>
        <p className="text-xs text-amber-700">Browse the network freely. Upgrade to actually send invites and open rooms.</p>
      </div>
      <Link
        href="/vendor/billing"
        className="shrink-0 rounded-lg bg-amber-900 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-800"
      >
        Upgrade
      </Link>
    </div>
  )
}

export function CollabsGate({ plan, children }: { plan: string; children: React.ReactNode }) {
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

  const isFree = tier === 'free'
  // Pass the shared tier down: demo mode on Free, and the plan so NetworkManager
  // gates owning collaborations (Pro only) without its own separate toggle.
  const content = isValidElement(children)
    ? cloneElement(
        children as React.ReactElement<{ demo?: boolean; plan?: Tier }>,
        { demo: isFree, plan: tier },
      )
    : children

  return (
    <div className="space-y-6">
      <PlanSwitch tier={tier} onPick={pick} caption="Collabs needs Basic or higher." />
      {isFree && <DemoBanner />}
      {content}
    </div>
  )
}
