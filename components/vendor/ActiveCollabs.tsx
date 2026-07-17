'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Users, CalendarPlus, ArrowRight } from 'lucide-react'
import { useCollaborations, useVendorActivity } from '@/lib/data-hooks'
import { collabEventDay, collabStatus, compareCollabs, STATUS_CLASS } from '@/lib/collab-status'
import { countUnread, loadSeen, type SeenMap } from '@/lib/unread'

// Your collaborations, on the front door — the "Upcoming" tab of the Collabs card.
//
// Commitments come before discovery: the things you're already in are worth more
// than any new match — the people in them are counting on you, and they're what
// actually becomes an event. So Upcoming is the LEFTMOST tab and the default one;
// you land on what you've already committed to, and go looking only if you want to.
//
// Everything you're in shows here, Planning and Active alike, soonest first. A
// collab that hasn't got a date yet is still yours to push along; hiding it
// until it's "real" is how it stops being real.
//
// Only collaborations with a CHAT are here. One whose invites are all still
// unanswered has no room, no thread, and nothing to open — it isn't a
// conversation yet, so it isn't in the conversation list.
//
// A vertical LIST, not a rail. This used to scroll sideways because it sat above
// the whole dashboard and was only a glance; inside a tab it's the thing you came
// for, and every card should be readable without dragging one out of view.
//
// The no-scroll-inside-a-scroll rule still holds and this doesn't break it: the
// list has no fixed height and no overflow, so it grows the page and scrolls with
// it. A vertical SCROLLBOX is what's banned — a plain stack is not.
//
// Self-hiding is preserved, but it's now the CALLER's job: with no collaborations
// there is no Upcoming tab at all, and the card opens on discovery exactly like it
// did for a business that hasn't started one yet. Hence the exported hook — the
// dashboard needs the count to decide, and SWR dedupes the shared key so asking
// for it twice costs nothing.

// The rows the Upcoming tab shows: chats only, soonest first (see compareCollabs).
export function useUpcomingCollabs(memberId: string | null | undefined, isAdmin: boolean) {
  const { collaborations } = useCollaborations(memberId, isAdmin)
  return useMemo(() => collaborations.filter((c) => c.roomId).sort(compareCollabs), [collaborations])
}

// The cards themselves, bare — no heading, no card wrapper. It renders INSIDE the
// Collabs card's tab body, which already supplies both.
export function UpcomingCollabs({ memberId, isAdmin }: { memberId: string; isAdmin: boolean }) {
  const { collab: activity } = useVendorActivity(memberId, isAdmin)
  const rows = useUpcomingCollabs(memberId, isAdmin)

  // Read state is per-device (localStorage) — the same source the Messages
  // badges use, so a thread you just read stops showing a count here too.
  const [seen, setSeen] = useState<SeenMap>({})
  useEffect(() => setSeen(loadSeen('collab')), [])
  const unread = useMemo(() => countUnread(activity, seen), [activity, seen])

  if (rows.length === 0) return null

  const qp = isAdmin ? `&memberId=${encodeURIComponent(memberId)}` : ''

  return (
    <>
        {/* Plain stack — no height cap, no overflow, so the page does the scrolling. */}
        <div className="space-y-3">
          {rows.map((c) => {
            const status = collabStatus(c)
            const n = unread[c.roomId ?? ''] ?? 0
            return (
              <div key={c.occasion_id}>
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
                      {/* The state sits where the roster line used to. It's the one
                          thing worth knowing at a glance; who's in, when, and where
                          are all one tap away inside the collaboration. */}
                      <span className="mt-1 flex">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_CLASS[status.key]}`}
                        >
                          {status.label}
                        </span>
                      </span>
                    </span>
                    {n > 0 && (
                      <span
                        aria-label={`${n} unread`}
                        className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-indigo-600 px-1.5 text-[11px] font-semibold tabular-nums text-white"
                      >
                        {n > 9 ? '9+' : n}
                      </span>
                    )}

                    {/* The collaboration already became an event — straight to it.
                        The date sits under the chip: once there's an event, WHEN
                        is the thing you want off a glance. */}
                    {c.eventId && (
                      <span className="flex shrink-0 flex-col items-center gap-0.5">
                        <Link
                          href={`/events/${c.eventId}`}
                          title="Go to the event page"
                          className="relative z-20 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1.5 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100"
                        >
                          <CalendarPlus className="h-3 w-3" />
                        </Link>
                        {collabEventDay(c) && (
                          <span className="text-[10px] font-medium tabular-nums text-stone-400">
                            {collabEventDay(c)}
                          </span>
                        )}
                      </span>
                    )}
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
    </>
  )
}
