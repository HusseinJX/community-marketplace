'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CalendarDays, MapPin, Check } from 'lucide-react'
import type { Opportunity } from '@/app/api/vendor/opportunities/route'
import { track } from '@/lib/track'

// "Opportunities near you" — events other hosts are putting on that the matching
// engine says you fit. The answer to the frequency problem: a reason to open the
// app between your OWN events. Asking to join creates a pending lineup entry the
// host approves (the same public self-join the event QR uses) — so it's not
// gated: never tax supply.
export function Opportunities({
  memberId,
  memberName,
  isAdmin,
  showEmpty = false,
}: {
  memberId: string
  memberName: string
  isAdmin: boolean
  // When this is the sole content of a card (the dashboard "Join" tab), render a
  // friendly empty state instead of collapsing to a blank card. Elsewhere it
  // still renders nothing when empty.
  showEmpty?: boolean
}) {
  const [items, setItems] = useState<Opportunity[] | null>(null)
  const [asked, setAsked] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    const qp = isAdmin ? `?memberId=${memberId}` : ''
    fetch(`/api/vendor/opportunities${qp}`)
      .then((r) => (r.ok ? r.json() : { opportunities: [] }))
      .then((d) => setItems(Array.isArray(d.opportunities) ? d.opportunities : []))
      .catch(() => setItems([]))
  }, [memberId, isAdmin])

  async function ask(o: Opportunity) {
    // Demo fixtures have no real event row — flip to "Asked" without a write so
    // the Admin demo shows the full request-to-join flow.
    if (o.eventId.startsWith('demo-')) {
      setAsked((s) => new Set(s).add(o.eventId))
      track('opportunity_ask_to_join', { eventId: o.eventId, fit: o.fit })
      return
    }
    setBusy(o.eventId)
    try {
      const res = await fetch('/api/events/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: o.eventId, memberId, memberName }),
      })
      if (res.ok) {
        setAsked((s) => new Set(s).add(o.eventId))
        track('opportunity_ask_to_join', { eventId: o.eventId, fit: o.fit })
      }
    } catch {
      /* leave the button as-is so they can retry */
    } finally {
      setBusy(null)
    }
  }

  // Still loading → render nothing (avoid flashing an empty state).
  if (!items) return null
  // No matches. Collapse to nothing, unless we're the card's sole content.
  if (items.length === 0) {
    if (!showEmpty) return null
    return (
      <div className="py-6 text-center">
        <p className="text-[15px] font-semibold text-stone-900">No open events to join right now</p>
        <p className="mx-auto mt-1 max-w-xs text-[13px] leading-snug text-stone-500">
          When a local host puts on an event that fits your business, it&apos;ll show up here to request to join.
        </p>
        <Link
          href="/vendor/organize"
          className="mt-3 inline-flex rounded-full bg-stone-900 px-3.5 py-2 text-[13px] font-semibold text-white transition hover:bg-stone-800"
        >
          Host your own event
        </Link>
      </div>
    )
  }

  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold text-stone-900">Opportunities near you</h2>

      <div className="space-y-2">
        {items.map((o) => {
          const done = asked.has(o.eventId)
          return (
            <div key={o.eventId} className="card-soft flex items-start gap-3 p-4">
              <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-stone-100">
                <CalendarDays className="h-4 w-4 text-stone-500" />
              </span>

              <div className="min-w-0 flex-1">
                <Link href={`/events/${o.eventId}`} className="block truncate text-sm font-semibold text-stone-900 hover:underline">
                  {o.title}
                </Link>
                <p className="mt-0.5 truncate text-xs text-stone-500">
                  {[o.date, `by ${o.hostName}`].filter(Boolean).join(' · ')}
                </p>
                {(o.location || typeof o.distanceMi === 'number') && (
                  <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-stone-400">
                    {o.location && (
                      <span className="flex min-w-0 items-center gap-1">
                        <MapPin className="h-3 w-3 shrink-0" />
                        <span className="truncate">{o.location}</span>
                      </span>
                    )}
                    {typeof o.distanceMi === 'number' && (
                      <span className="shrink-0 rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-medium text-stone-500">
                        {o.distanceMi < 10 ? o.distanceMi.toFixed(1) : Math.round(o.distanceMi)} mi
                      </span>
                    )}
                  </p>
                )}
                {o.fit && (
                  <span className="mt-1.5 flex flex-wrap gap-1">
                    {(o.reasons.length ? o.reasons : ['Matches what you offer']).map((r, i) => (
                      <span key={i} className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                        {r}
                      </span>
                    ))}
                  </span>
                )}
              </div>

              <button
                onClick={() => !done && ask(o)}
                disabled={done || busy === o.eventId}
                className={`shrink-0 rounded-full px-3.5 py-2 text-[13px] font-semibold transition ${
                  done
                    ? 'bg-stone-100 text-stone-500'
                    : 'bg-stone-900 text-white hover:bg-stone-800 disabled:opacity-50'
                }`}
              >
                {done ? (
                  <span className="inline-flex items-center gap-1">
                    <Check className="h-3.5 w-3.5" /> Asked
                  </span>
                ) : busy === o.eventId ? (
                  'Asking…'
                ) : (
                  'Ask to join'
                )}
              </button>
            </div>
          )
        })}
      </div>
    </section>
  )
}
