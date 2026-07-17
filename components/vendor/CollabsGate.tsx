'use client'

import { cloneElement, isValidElement, useEffect, useState } from 'react'
import { PLAN_KEY, type Tier } from '@/components/vendor/PlanSwitch'

// Gates the Collabs surface. Per pricing, ANYONE — including Free — can be
// invited: Free members really receive/accept collab invites and chat in the
// rooms they join. What Free CAN'T do is INITIATE (send invites / own a
// collaboration / create the event) — that's gated by `plan` in NetworkManager
// (Member+). So Free is a real, non-demo participant here, not a preview.
//
// Only the admin demo (`adminDemo`) runs the inert, seeded preview.
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

  // Pass the shared tier down as `plan` so NetworkManager gates INITIATING
  // (send/own/create — Member+) while everyone, Free included, gets the real
  // receive-and-chat surface. Only the admin demo runs the inert preview.
  const content = isValidElement(children)
    ? cloneElement(
        children as React.ReactElement<{ demo?: boolean; adminDemo?: boolean; plan?: Tier }>,
        { demo: false, adminDemo, plan: tier },
      )
    : children

  // flex-1/min-h-0 are inert in the list view (the parent there is a plain block)
  // but let an open chat inherit the shell's full-screen height through the gate
  // — without them the height stops here and the composer floats mid-screen.
  return <div className="flex min-h-0 flex-1 flex-col space-y-6">{content}</div>
}
