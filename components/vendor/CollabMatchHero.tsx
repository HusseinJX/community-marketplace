'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Lock } from 'lucide-react'
import { MatchFinder } from '@/components/match/MatchFinder'
import type { MatchCandidate } from '@/lib/types'
import { track } from '@/lib/track'

// The wedge, live on the dashboard: no hero chrome, no pitch — the semantic
// matcher IS the front door. A vendor opens the portal and the first thing they
// see is complementary businesses to team up with, each selectable.
//
// Inviting hits the same backend as the network invite modal
// (POST /api/vendor/rooms → creates the occasion room + one invite each).
export function CollabMatchHero({
  memberId,
  isAdmin,
  canInvite,
  mode,
  onModeChange,
  hideTabs,
}: {
  memberId: string
  isAdmin: boolean
  /** Sending invites is a Pro capability; lower tiers see the matches as a teaser. */
  canInvite: boolean
  /** Controlled For-you/Search mode (parent owns the tabs so they persist). */
  mode?: 'for-you' | 'search' | 'similar'
  onModeChange?: (m: 'for-you' | 'search' | 'similar') => void
  hideTabs?: boolean
}) {
  const [picked, setPicked] = useState<Map<string, MatchCandidate>>(new Map())
  const [sent, setSent] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [upsell, setUpsell] = useState(false)

  const excludeIds = useMemo(() => new Set([memberId]), [memberId])

  function toggle(c: MatchCandidate) {
    if (!canInvite) {
      setUpsell(true)
      return
    }
    setPicked((s) => {
      const n = new Map(s)
      if (n.has(c.id)) n.delete(c.id)
      else n.set(c.id, c)
      return n
    })
  }

  async function invite() {
    if (picked.size === 0) return
    const targets = [...picked.values()]
    // One tap sends it. The collaboration is named after who's in it — the pair
    // can retitle and shape it in the room, which is where that decision belongs.
    const title = targets.map((c) => c.name).join(' + ')
    setBusy(true)
    setMsg('')
    try {
      const res = await fetch('/api/vendor/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          invitees: targets.map((c) => ({ id: c.id, name: c.name })),
          role: 'vendor',
          occasionId:
            typeof crypto !== 'undefined' && crypto.randomUUID
              ? crypto.randomUUID()
              : `occ-${Math.round(performance.now())}`,
          occasionLabel: title,
          memberId: isAdmin ? memberId : undefined,
        }),
      })
      if (!res.ok) {
        setMsg('Couldn’t send those invites. Try again.')
        return
      }
      setSent((s) => {
        const n = new Set(s)
        targets.forEach((c) => n.add(c.id))
        return n
      })
      setPicked(new Map())
      track('collab_invite_sent', { count: targets.length, source: 'dashboard' })
      track('collab_started', { source: 'dashboard', invited: targets.length })
      setMsg(`Invited ${targets.length}. Keep talking in Collabs.`)
    } catch {
      setMsg('Couldn’t send those invites. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="space-y-3">
      {/* The For-you / Search tabs sit right at the top (the parent card owns the
          title + People/Events toggle). On lower tiers search is dropped so it's
          a calm teaser — just the people who fit. */}
      <MatchFinder
        memberId={memberId}
        isAdmin={isAdmin}
        searchable={canInvite}
        mode={mode}
        onModeChange={onModeChange}
        hideTabs={hideTabs}
        selected={new Set(picked.keys())}
        onToggle={toggle}
        sentIds={sent}
        excludeIds={excludeIds}
        placeholder="Describe who you need — “muralist for a launch night”"
      />

      {msg && <p className="text-[13px] text-stone-500">{msg}</p>}

      {/* Upgrade notice — shown once a gated tier taps a match */}
      {!canInvite && upsell && (
        <div className="card-soft flex items-center gap-3 p-4">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-stone-100">
            <Lock className="h-4 w-4 text-stone-500" />
          </span>
          <p className="min-w-0 flex-1 text-[13px] leading-snug text-stone-600">
            Anyone can see who fits. <span className="font-medium text-stone-900">Inviting starts at Basic.</span>
          </p>
          <Link
            href="/vendor/billing"
            className="shrink-0 rounded-full bg-stone-900 px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-stone-800"
          >
            Upgrade
          </Link>
        </div>
      )}

      {/* Action bar — one tap. No name, no role, no message: those are decisions
          for the room, not the doorway. */}
      {canInvite && picked.size > 0 && (
        <div className="card-soft flex items-center gap-3 p-4">
          <span className="min-w-0 flex-1 truncate text-[13px] text-stone-600">
            {[...picked.values()].map((c) => c.name).join(', ')}
          </span>
          <button onClick={() => setPicked(new Map())} className="shrink-0 text-xs text-stone-500 hover:text-stone-700">
            Clear
          </button>
          <button
            onClick={invite}
            disabled={busy}
            className="shrink-0 rounded-full bg-indigo-600 px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {busy ? 'Inviting…' : `Invite ${picked.size}`}
          </button>
        </div>
      )}
    </section>
  )
}
