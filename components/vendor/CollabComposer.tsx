'use client'

import { useState } from 'react'
import { PeoplePicker } from '@/components/match/PeoplePicker'
import { addDemoCollab } from '@/lib/demo-collab-store'
import type { MatchCandidate } from '@/lib/types'
import { track } from '@/lib/track'

// The one collaboration composer, shared by the dashboard "Create" card and the
// Messages "New collaboration" modal so they are literally identical: name +
// short description + the For-you/Search people picker + a create button.
// Adding people to an EXISTING collaboration reuses it (pass `existing`) — then
// the name/description inputs drop and it's just the picker + "Invite".
export function CollabComposer({
  memberId,
  isAdmin,
  demo = false,
  canInvite = true,
  seedTitle = '',
  seedDesc = '',
  seedPeople = [],
  existing,
  source = 'unknown',
  collaborationsBefore = 0,
  onDone,
}: {
  memberId: string
  isAdmin: boolean
  demo?: boolean
  /** Lower tiers can browse the matcher but not create; the button stays disabled. */
  canInvite?: boolean
  seedTitle?: string
  seedDesc?: string
  seedPeople?: MatchCandidate[]
  /** Add-to-existing: fixed occasion — hides the name/description inputs. */
  existing?: { occasionId: string; label: string }
  source?: string
  collaborationsBefore?: number
  // `occasionId` is the collaboration's id — callers use it to deep-link
  // straight into the new chat rather than dumping you on the list.
  onDone?: (info: { title: string; count: number; occasionId: string }) => void
}) {
  const [title, setTitle] = useState(existing?.label ?? seedTitle)
  const [desc, setDesc] = useState(seedDesc)
  const [picked, setPicked] = useState<Map<string, MatchCandidate>>(
    () => new Map(seedPeople.map((p) => [p.id, p])),
  )
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const isNew = !existing
  const ready = canInvite && picked.size > 0 && (!isNew || title.trim().length > 0)

  function toggle(c: MatchCandidate) {
    setPicked((s) => {
      const n = new Map(s)
      if (n.has(c.id)) n.delete(c.id)
      else n.set(c.id, c)
      return n
    })
  }

  async function submit() {
    if (!ready) return
    const targets = [...picked.values()]
    const name = (existing?.label ?? title).trim()
    const occasionId =
      existing?.occasionId ??
      (typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `occ-${Math.round(performance.now())}`)
    // Demo/preview: no backend, so stash it locally — otherwise the thing you
    // just created wouldn't exist when the "open the chat" link lands.
    if (demo) {
      addDemoCollab({
        occasion_id: occasionId,
        label: name,
        created_at: new Date().toISOString(),
        members: targets.map((c) => ({ to_id: c.id, to_name: c.name, role: 'vendor' })),
      })
      return onDone?.({ title: name, count: targets.length, occasionId })
    }
    setBusy(true)
    setErr('')
    try {
      const res = await fetch('/api/vendor/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: name,
          message: desc.trim() || undefined, // rides along as the invite line
          invitees: targets.map((c) => ({ id: c.id, name: c.name })),
          role: 'vendor',
          occasionId,
          occasionLabel: name,
          memberId: isAdmin ? memberId : undefined,
        }),
      })
      if (!res.ok) {
        setErr('Couldn’t save that. Try again.')
        return
      }
      track('collab_invite_sent', { count: targets.length, source })
      if (isNew) {
        track('collab_started', { source, invited: targets.length, collaborations_before: collaborationsBefore })
      }
      onDone?.({ title: name, count: targets.length, occasionId })
    } catch {
      setErr('Couldn’t save that. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      {isNew && (
        <>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Name your collaboration — e.g. “Summer block party”"
            className="w-full rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          />
          {/* The description only earns its space once it has something to
              describe — no name, no box. */}
          {title.trim().length > 0 && (
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              rows={2}
              placeholder="What’s it about? (a line the people you invite will see)"
              className="w-full resize-none rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
          )}
        </>
      )}

      <p className="px-1 text-[11px] font-semibold uppercase tracking-wide text-stone-400">Invite people</p>

      <PeoplePicker
        memberId={memberId}
        isAdmin={isAdmin}
        demo={demo}
        picked={picked}
        onToggle={toggle}
      />

      {err && <p className="text-[13px] text-rose-600">{err}</p>}

      {picked.size > 0 && (
        <div className="card-soft flex items-center gap-3 p-4">
          <span className="min-w-0 flex-1 truncate text-[13px] text-stone-600">
            {[...picked.values()].map((c) => c.name).join(', ')}
          </span>
          <button
            onClick={() => setPicked(new Map())}
            className="shrink-0 text-xs text-stone-500 hover:text-stone-700"
          >
            Clear
          </button>
          <button
            onClick={submit}
            disabled={busy || !ready}
            title={isNew && !title.trim() ? 'Name your collaboration first' : undefined}
            className="shrink-0 rounded-full bg-indigo-600 px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {busy
              ? isNew
                ? 'Creating…'
                : 'Inviting…'
              : isNew
                ? `Create collaboration · ${picked.size}`
                : `Invite ${picked.size}`}
          </button>
        </div>
      )}
    </div>
  )
}
