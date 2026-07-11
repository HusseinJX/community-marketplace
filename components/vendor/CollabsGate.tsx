'use client'

import { cloneElement, isValidElement, useEffect, useState } from 'react'
import { PlanSwitch, PLAN_KEY, type Tier } from '@/components/vendor/PlanSwitch'

// Gates the Collabs surface. On Free the member gets the SAME interactive UI as
// Basic — they can click around, switch tabs, browse matches. The per-tab notice
// cards (in NetworkManager) explain what's demo. The tier switch shares state
// with the dashboard (same localStorage key).

export function CollabsGate({
  plan,
  adminDemo = false,
  children,
}: {
  plan: string
  adminDemo?: boolean
  children: React.ReactNode
}) {
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
        children as React.ReactElement<{ demo?: boolean; adminDemo?: boolean; plan?: Tier }>,
        { demo: isFree, adminDemo, plan: tier },
      )
    : children

  return (
    <div className="space-y-6">
      <PlanSwitch tier={tier} onPick={pick} caption="Collabs needs Basic or higher." />
      {content}
    </div>
  )
}
