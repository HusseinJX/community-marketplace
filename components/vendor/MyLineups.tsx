'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { CalendarCheck, ChevronRight, MapPin } from 'lucide-react'
import { roleDef } from '@/lib/lineup-roles'

interface Lineup {
  id: string
  title: string
  date: string | null
  time: string | null
  location: string | null
  role: string | null
  hostName: string | null
}

/**
 * Events this business has been accepted onto — someone else's market or
 * festival, not their own.
 *
 * This existed nowhere before. Every lineup query was written "who is on this
 * event?", for the organizer; a vendor who accepted an invite watched it
 * disappear, because "My events" lists only what they HOST. They had signed up
 * for something with nowhere to see it, and "when is the thing I said yes to?"
 * had no answer inside the app.
 *
 * Self-hides when empty: most vendors are on no one's lineup, and an empty
 * "you're not on anything" card is just noise on their dashboard.
 */
export function MyLineups({ memberId }: { memberId?: string } = {}) {
  const [events, setEvents] = useState<Lineup[] | null>(null)

  const load = useCallback(() => {
    const qs = memberId ? `?memberId=${encodeURIComponent(memberId)}` : ''
    fetch(`/api/vendor/my-lineups${qs}`)
      .then((r) => (r.ok ? r.json() : { events: [] }))
      .then((d) => setEvents(Array.isArray(d.events) ? d.events : []))
      .catch(() => setEvents([]))
  }, [memberId])

  useEffect(load, [load])

  if (!events || events.length === 0) return null

  return (
    <div className="mb-6">
      <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-stone-400">
        You&apos;re on the lineup
      </h2>
      <div className="space-y-2">
        {events.map((e) => {
          const role = e.role ? roleDef(e.role) : null
          return (
            <Link
              key={e.id}
              href={`/events/${e.id}`}
              className="card-soft card-hover flex items-center gap-3 p-4"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-emerald-50">
                <CalendarCheck className="h-4 w-4 text-emerald-600" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-stone-900">{e.title}</span>
                <span className="mt-0.5 block truncate text-xs text-stone-500">
                  {[e.date, e.time].filter(Boolean).join(' · ') || 'Date to be confirmed'}
                  {e.hostName ? ` · hosted by ${e.hostName}` : ''}
                </span>
                {e.location && (
                  <span className="mt-0.5 flex items-center gap-1 truncate text-xs text-stone-500">
                    <MapPin className="h-3 w-3 shrink-0" />
                    {e.location}
                  </span>
                )}
              </span>
              {/* The role is the one thing they can't work out from the public
                  page — it's what they agreed to turn up AS. */}
              {role && (
                <span className="shrink-0 rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-600">
                  {role.label}
                </span>
              )}
              <ChevronRight className="h-4 w-4 shrink-0 text-stone-400" />
            </Link>
          )
        })}
      </div>
    </div>
  )
}
