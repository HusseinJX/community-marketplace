'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PeoplePicker } from '@/components/match/PeoplePicker'
import { roleDef, inferRole } from '@/lib/lineup-roles'
import type { MatchCandidate } from '@/lib/types'

// The event composer — the same shape as the collaboration composer: name it,
// say what it is, pick who's in, create. The extras an event needs (when/where,
// capacity) sit between the two, and the people you pick become the lineup.
export function NewEventForm({
  memberId,
  memberName,
  isAdmin,
  demo,
}: {
  memberId: string
  memberName: string
  isAdmin: boolean
  demo: boolean
}) {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [location, setLocation] = useState('')
  const [capacity, setCapacity] = useState('')
  const [picked, setPicked] = useState<Map<string, MatchCandidate>>(new Map())
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const named = title.trim().length > 0
  const ready = named && !busy

  function toggle(c: MatchCandidate) {
    setPicked((s) => {
      const n = new Map(s)
      if (n.has(c.id)) n.delete(c.id)
      else n.set(c.id, c)
      return n
    })
  }

  async function create() {
    if (!ready) return
    const targets = [...picked.values()]
    if (demo) return router.push('/vendor/organize')
    setBusy(true)
    setErr('')
    try {
      const res = await fetch(`/api/events/${memberId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberName,
          title: title.trim(),
          description: desc.trim() || null,
          event_date: date.trim() || null,
          event_time: time.trim() || null,
          location: location.trim() || null,
          capacity: capacity.trim() || null,
          active: true,
        }),
      })
      const d = await res.json().catch(() => ({}))
      const eventId = d?.created?.[0]?.id
      if (!res.ok || !eventId) {
        setErr(d?.error || 'Couldn’t create that event. Try again.')
        return
      }
      // Whoever you picked becomes the opening lineup — best-effort, since the
      // event itself already exists and you can add people from the Lineup tab.
      if (targets.length > 0) {
        await fetch(`/api/vendor/events/${eventId}/lineup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            invitees: targets.map((c) => ({ id: c.id, name: c.name, role: inferRole(c) })),
            memberId: isAdmin ? memberId : undefined,
          }),
        }).catch(() => null)
      }
      // Land inside the event you just made, not back on the list.
      router.push(`/vendor/organize?event=${encodeURIComponent(eventId)}`)
    } catch {
      setErr('Couldn’t create that event. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Name your event — e.g. “Neighborhood Night Market”"
        className="w-full rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
      />

      {/* Everything else earns its space only once it has something to describe. */}
      {named && (
        <>
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            rows={2}
            placeholder="What’s it about? (shown on the public event page)"
            className="w-full resize-none rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          />

          <div className="grid gap-2 sm:grid-cols-2">
            <input
              value={date}
              onChange={(e) => setDate(e.target.value)}
              placeholder="Date — e.g. 2026-08-15"
              className="w-full rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
            <input
              value={time}
              onChange={(e) => setTime(e.target.value)}
              placeholder="Time — e.g. 6:00 PM – 10:00 PM"
              className="w-full rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Where — e.g. Dolores Park"
              className="w-full rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
            <input
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              inputMode="numeric"
              placeholder="Capacity (optional)"
              className="w-full rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          <p className="px-1 text-[11px] font-semibold uppercase tracking-wide text-stone-400">
            Invite people (optional)
          </p>
          <PeoplePicker
            memberId={memberId}
            isAdmin={isAdmin}
            demo={demo}
            picked={picked}
            onToggle={toggle}
            excludeIds={new Set([memberId])}
            placeholder="Search — “taco truck”, “muralist”, “live band”…"
            emptyHint="Search to line up vendors, performers, sponsors… or do it later."
          />

          {/* Roles are inferred from what each business already is — no
              "invite as" step for the organizer to answer. */}
          {picked.size > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {[...picked.values()].map((c) => (
                <span
                  key={c.id}
                  className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2.5 py-1 text-[11px] font-medium text-stone-600"
                >
                  {roleDef(inferRole(c)).emoji} {c.name}
                </span>
              ))}
            </div>
          )}
        </>
      )}

      {err && <p className="text-[13px] text-rose-600">{err}</p>}

      <button
        onClick={create}
        disabled={!ready}
        title={named ? undefined : 'Name your event first'}
        className="w-full rounded-full bg-indigo-600 px-3.5 py-2.5 text-[13px] font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
      >
        {busy
          ? 'Creating…'
          : picked.size > 0
            ? `Create event · invite ${picked.size}`
            : 'Create event'}
      </button>
    </div>
  )
}
