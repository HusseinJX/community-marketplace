'use client'

import { cloneElement, isValidElement, useEffect, useState } from 'react'
import { PLAN_KEY, type Tier } from '@/components/vendor/PlanSwitch'

// Gates the Collabs surface. On Free the member gets the SAME interactive UI as
// Basic — they can click around, switch tabs, browse matches. The per-tab notice
// cards (in NetworkManager) explain what's demo.
//
// The tier PREVIEW SWITCH is deliberately not rendered here. Collabs now lives
// inside Messages — a primary nav tab — and a plan toggle is demo scaffolding,
// not product: it has no business being the first thing a real vendor sees in
// their inbox. This still READS the shared preview tier from localStorage, so
// flipping tiers elsewhere (e.g. a dev/admin surface that sets PLAN_KEY) is
// still reflected here; it just doesn't offer the control.

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

  const isFree = tier === 'free'
  // Pass the shared tier down: demo mode on Free, and the plan so NetworkManager
  // gates owning collaborations (Pro only) without its own separate toggle.
  const content = isValidElement(children)
    ? cloneElement(
        children as React.ReactElement<{ demo?: boolean; adminDemo?: boolean; plan?: Tier }>,
        { demo: isFree, adminDemo, plan: tier },
      )
    : children

  return <div className="space-y-6">{content}</div>
}
