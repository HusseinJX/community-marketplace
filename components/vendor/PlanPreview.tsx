'use client'

import { useEffect, useState } from 'react'
import { PlanSwitch, PLAN_KEY, type Tier } from '@/components/vendor/PlanSwitch'

// The tier preview switch, in the one place it belongs: billing.
//
// It used to sit at the top of the dashboard and (after the Collabs→Messages
// merge) at the top of the Messages tab — i.e. demo scaffolding occupying the
// app's primary surfaces. It's a useful thing to have for demos, so it lives
// here rather than being deleted, and only admins see it.
export function PlanPreview({ isAdmin }: { isAdmin: boolean }) {
  const [tier, setTier] = useState<Tier>('pro')

  useEffect(() => {
    const v = localStorage.getItem(PLAN_KEY)
    if (v === 'free' || v === 'member' || v === 'pro') setTier(v)
  }, [])

  if (!isAdmin) return null

  function pick(t: Tier) {
    setTier(t)
    localStorage.setItem(PLAN_KEY, t)
  }

  return (
    <PlanSwitch
      tier={tier}
      onPick={pick}
      caption="Admin only — previews what each tier sees across the portal."
    />
  )
}
