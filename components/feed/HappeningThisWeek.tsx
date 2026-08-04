"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Calendar, MapPin, ArrowRight } from "lucide-react";
import { useLocation, matchesPlace, placeIsSet, placeLabel } from "@/lib/location";
import { useEventsFeed } from "@/lib/data-hooks";

const gradients = [
  "from-emerald-300 to-teal-500",
  "from-indigo-300 to-purple-500",
  "from-amber-300 to-orange-500",
  "from-pink-300 to-rose-500",
  "from-sky-300 to-blue-500",
];
function gradientFor(s: string) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return gradients[h % gradients.length];
}

export function HappeningThisWeek() {
  const { place } = useLocation();
  // Shared cache with the community feed (same /api/events/feed key).
  const { events, loading } = useEventsFeed();

  // Scope to the selected place. Events with no known place still show (so
  // sparse/legacy data isn't hidden); placed events scope properly.
  const shown = useMemo(
    () =>
      events
        .filter((e) => (!e.city && !e.neighborhood) || matchesPlace(place, e))
        .slice(0, 12),
    [events, place]
  );

  const scoped = placeIsSet(place);

  // Until the feed has data, don't take up space.
  if (loading || events.length === 0) return null;

  return (
    <section className="mb-8">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-stone-900">
            Happening this week{scoped ? ` in ${placeLabel(place)}` : ""}
          </h2>
          <p className="text-sm text-stone-500">Local events near you — RSVP and show up.</p>
        </div>
        <Link href="/?tab=events" className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-indigo-700 hover:underline">
          See all <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {scoped && shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white/60 p-4 text-sm text-stone-500">
          Nothing in {placeLabel(place)} this week yet.{" "}
          <Link href="/vendor/organize" className="font-medium text-indigo-700 hover:underline">Host the first one</Link>, or switch your area above.
        </div>
      ) : (
      <div className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2">
        {shown.map((e) => (
          <Link
            key={e.eventId}
            href={`/events/${e.eventId}`}
            className="group w-60 shrink-0 snap-start overflow-hidden rounded-2xl border border-stone-200 bg-white transition hover:border-stone-300"
          >
            {e.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={e.image} alt={e.title} className="h-28 w-full object-cover" />
            ) : (
              <div className={`h-28 w-full bg-gradient-to-br ${gradientFor(e.title)}`} />
            )}
            <div className="p-3">
              <p className="line-clamp-2 text-sm font-semibold text-stone-900 group-hover:text-indigo-700">{e.title}</p>
              {e.date && (
                <p className="mt-1.5 flex items-center gap-1 text-xs text-stone-500">
                  <Calendar className="h-3.5 w-3.5" /> {e.date}
                </p>
              )}
              {e.location && (
                <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-stone-500">
                  <MapPin className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{e.location}</span>
                </p>
              )}
              <p className="mt-1 truncate text-xs text-stone-400">by {e.memberName}</p>
            </div>
          </Link>
        ))}
      </div>
      )}
    </section>
  );
}
