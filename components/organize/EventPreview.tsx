"use client";

import { useEffect, useState } from "react";
import { Calendar, Clock, MapPin, Users, ExternalLink, Eye } from "lucide-react";
import type { VendorEvent } from "@/lib/vendor-connect";
import type { CollabInvite } from "@/lib/collab-network";
import { groupByRole } from "@/lib/lineup-roles";

const GRADIENTS = [
  "from-emerald-300 to-teal-500",
  "from-indigo-300 to-purple-500",
  "from-amber-300 to-orange-500",
  "from-pink-300 to-rose-500",
  "from-sky-300 to-blue-500",
];
function gradientFor(s: string) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return GRADIENTS[h % GRADIENTS.length];
}

// Chrome-less inline preview of the public event body (no app nav). Mirrors
// /events/[id]: hero, header, details, lineup-by-role, going count.
export function EventPreview({ event, isAdmin, memberId }: { event: VendorEvent; isAdmin: boolean; memberId: string }) {
  const [lineup, setLineup] = useState<CollabInvite[]>([]);
  const [going, setGoing] = useState(0);
  const qp = isAdmin ? `?memberId=${memberId}` : "";

  useEffect(() => {
    fetch(`/api/vendor/events/${event.id}/lineup${qp}`)
      .then((r) => (r.ok ? r.json() : { lineup: [] }))
      .then((d) => setLineup(Array.isArray(d.lineup) ? d.lineup : []))
      .catch(() => {});
    fetch(`/api/vendor/events/${event.id}/attendees${qp}`)
      .then((r) => (r.ok ? r.json() : { count: 0 }))
      .then((d) => setGoing(d.count ?? 0))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event.id]);

  const accepted = lineup.filter((i) => i.status === "accepted");
  const groups = groupByRole(accepted);
  const when = [event.event_date, event.event_time].filter(Boolean).join(" · ");

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm text-stone-500">
          <Eye className="h-4 w-4 text-indigo-500" /> How your event looks to the public.
        </p>
        <a
          href={`/events/${event.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 hover:border-stone-300 hover:text-stone-900"
        >
          <ExternalLink className="h-3.5 w-3.5" /> Open live page
        </a>
      </div>

      {!event.active && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          This event is a <strong>draft</strong> — publish it for visitors to find it.
        </div>
      )}

      {/* The public event body, rendered inline */}
      <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
        {event.poster_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={event.poster_image_url} alt={event.title} className="aspect-[16/9] w-full object-cover" />
        ) : (
          <div className={`aspect-[16/7] w-full bg-gradient-to-br ${gradientFor(event.title)}`} />
        )}

        <div className="space-y-5 p-4 sm:p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-stone-900 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">Event</span>
            <span className="rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Open to all</span>
          </div>

          <h1 className="text-2xl font-bold leading-tight text-stone-900 sm:text-3xl">{event.title}</h1>

          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-stone-600">
            {when && (
              <span className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-stone-400" /> {event.event_date}
                {event.event_time && (
                  <>
                    <span className="mx-0.5 text-stone-300">·</span>
                    <Clock className="h-4 w-4 text-stone-400" /> {event.event_time}
                  </>
                )}
              </span>
            )}
            {event.location && (
              <span className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-stone-400" /> {event.location}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <Users className="h-4 w-4 text-stone-400" /> {going} going
            </span>
          </div>

          {event.description && <p className="whitespace-pre-line text-sm leading-relaxed text-stone-700">{event.description}</p>}

          {groups.length > 0 && (
            <div className="border-t border-stone-100 pt-4">
              <p className="section-label mb-3">Lineup</p>
              <div className="space-y-3">
                {groups.map((g) => (
                  <div key={g.role.key}>
                    <p className="mb-1.5 text-xs font-medium text-stone-500">
                      {g.role.emoji} {g.role.label}
                      {g.items.length > 1 ? "s" : ""}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {g.items.map((i) => (
                        <span key={i.id} className="rounded-full border border-stone-200 bg-stone-50 px-2.5 py-1 text-xs text-stone-700">
                          {i.to_name || "Collaborator"}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-xl bg-stone-50 px-4 py-3 text-center text-sm text-stone-400">
            RSVP button appears here on the live page
          </div>
        </div>
      </div>
    </div>
  );
}
