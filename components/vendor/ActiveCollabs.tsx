'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Users, CalendarPlus, CalendarClock, MapPin, ArrowRight } from 'lucide-react'
import { useCollaborations, useVendorActivity } from '@/lib/data-hooks'
import { collabRoster, collabWhenLabel, collabWhere, collabStatus, compareCollabs, STATUS_CLASS } from '@/lib/collab-status'
import { countUnread, loadSeen, type SeenMap } from '@/lib/unread'

// Your collaborations, on the front door.
//
// Commitments come before discovery: the things you're already in are worth more
// than any new match — the people in them are counting on you, and they're what
// actually becomes an event. So this sits ABOVE the find-a-collaboration card.
//
// Everything you're in shows here, Planning and Active alike, soonest first. A
// collab that hasn't got a date yet is still yours to push along; hiding it
// until it's "real" is how it stops being real.
//
// Only collaborations with a CHAT are here. One whose invites are all still
// unanswered has no room, no thread, and nothing to open — it isn't a
// conversation yet, so it isn't in the conversation list.
//
// Scrolls sideways rather than down the page: this is the glance, and the whole
// dashboard sits below it. (Horizontal is the app's pattern for a rail — see
// FeaturedLists. A VERTICAL scrollbox here would be a scroll inside a scroll,
// which is the one thing we don't do on a phone.)
//
// Self-hiding: no collaborations → renders nothing, and the dashboard opens on
// discovery exactly like it used to for a business that hasn't started one yet.

export function ActiveCollabs({ memberId, isAdmin }: { memberId: string; isAdmin: boolean }) {
  const { collaborations } = useCollaborations(memberId, isAdmin)
  const { collab: activity } = useVendorActivity(memberId, isAdmin)

  // Read state is per-device (localStorage) — the same source the Messages
  // badges use, so a thread you just read stops showing a count here too.
  const [seen, setSeen] = useState<SeenMap>({})
  useEffect(() => setSeen(loadSeen('collab')), [])
  const unread = useMemo(() => countUnread(activity, seen), [activity, seen])

  // Chats only, soonest first (see compareCollabs).
  const rows = useMemo(() => collaborations.filter((c) => c.roomId).sort(compareCollabs), [collaborations])

  if (rows.length === 0) return null

  const qp = isAdmin ? `&memberId=${encodeURIComponent(memberId)}` : ''

  return (
    <div>
      <h2 className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-stone-400">Upcoming collabs</h2>

      <div className="card-soft p-4 sm:p-5">
        {/* The rail. Negative margins let cards bleed to the card's edge so the
            last one doesn't look clipped mid-scroll. */}
        <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:-mx-5 sm:px-5 [scrollbar-width:thin]">
          {rows.map((c) => {
            const status = collabStatus(c)
            const when = collabWhenLabel(c)
            const where = collabWhere(c)
            const n = unread[c.roomId ?? ''] ?? 0
            return (
              <div key={c.occasion_id} className="w-[19rem] shrink-0 snap-start">
                {/* The WHOLE card opens the collaboration — a stretched link over
                    the card, rather than a link around the title. Having to hit
                    the words is a miss waiting to happen on a phone. The event
                    chip sits above it (z-20) as the one exception. */}
                <div className="card-soft card-hover relative h-full w-full p-4">
                  <Link
                    href={`/vendor/messages?tab=collabs&collab=${encodeURIComponent(c.occasion_id)}${qp}`}
                    aria-label={`Open ${c.label}`}
                    className="absolute inset-0 z-10 rounded-2xl"
                  />

                  <div className="flex items-center gap-2">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-stone-100">
                      <Users className="h-4 w-4 text-stone-500" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-stone-900">{c.label}</span>
                      <span className="mt-0.5 block truncate text-xs text-stone-500">{collabRoster(c)}</span>
                    </span>
                    {n > 0 && (
                      <span
                        aria-label={`${n} unread`}
                        className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-indigo-600 px-1.5 text-[11px] font-semibold tabular-nums text-white"
                      >
                        {n > 9 ? '9+' : n}
                      </span>
                    )}

                    {/* The collaboration already became an event — straight to it. */}
                    {c.eventId && (
                      <Link
                        href={`/events/${c.eventId}`}
                        title="Go to the event page"
                        className="relative z-20 inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2 py-1.5 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100"
                      >
                        <CalendarPlus className="h-3 w-3" />
                      </Link>
                    )}
                  </div>

                  {/* When, then where — a line each. Only once the event exists. */}
                  {when && (
                    <p className="mt-1.5 flex items-center gap-1 text-xs text-stone-500">
                      <CalendarClock className="h-3 w-3 shrink-0 text-stone-400" />
                      <span className="truncate">{when}</span>
                    </p>
                  )}
                  {where && (
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-stone-500">
                      <MapPin className="h-3 w-3 shrink-0 text-stone-400" />
                      <span className="truncate">{where}</span>
                    </p>
                  )}

                  <div className="mt-3 border-t border-stone-100 pt-2.5">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_CLASS[status.key]}`}
                    >
                      {status.label}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <Link
          href={`/vendor/messages?tab=collabs${isAdmin ? `&memberId=${encodeURIComponent(memberId)}` : ''}`}
          className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-stone-900 px-3.5 py-2 text-[13px] font-semibold text-white transition hover:bg-stone-800"
        >
          Open in Messages <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  )
}
