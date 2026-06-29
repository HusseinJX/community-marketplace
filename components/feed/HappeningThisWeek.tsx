"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Calendar, MapPin, ArrowRight, CalendarPlus, Sparkles } from "lucide-react";
import { useLocation, matchesPlace, placeIsSet, placeLabel } from "@/lib/location";

interface FeedEvent {
  eventId: string;
  title: string;
  date: string;
  location: string;
  city: string;
  neighborhood: string;
  description: string;
  image: string | null;
  memberId: string;
  memberName: string;
}

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
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/events/feed")
      .then((r) => (r.ok ? r.json() : { events: [] }))
      .then((d) => setEvents(Array.isArray(d.events) ? d.events : []))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

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
  if (loaded && events.length === 0) {
    return (
      <section className="mb-6 rounded-2xl border border-dashed border-indigo-200 bg-indigo-50/50 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="flex items-center gap-1.5 text-sm font-semibold text-stone-900">
              <Sparkles className="h-4 w-4 text-indigo-500" /> Nothing scheduled yet
            </p>
            <p className="mt-0.5 text-sm text-stone-500">Be the first to host something local — markets, popups, shows.</p>
          </div>
          <Link href="/vendor/organize" className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
            <CalendarPlus className="h-4 w-4" /> Host an event
          </Link>
        </div>
      </section>
    );
  }
  if (!loaded || events.length === 0) return null;

  return (
    <section className="mb-8">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-stone-900">
            Happening this week{scoped ? ` in ${placeLabel(place)}` : ""}
          </h2>
          <p className="text-sm text-stone-500">Local events near you — RSVP and show up.</p>
        </div>
        <Link href="/events?view=events" className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-indigo-700 hover:underline">
          See all <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {scoped && shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white/60 p-5 text-sm text-stone-500">
          Nothing in {placeLabel(place)} this week yet.{" "}
          <Link href="/vendor/organize" className="font-medium text-indigo-700 hover:underline">Host the first one</Link>, or switch your area above.
        </div>
      ) : (
      <div className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2">
        {shown.map((e) => (
          <Link
            key={e.eventId}
            href={`/events/${e.eventId}`}
            className="group w-60 shrink-0 snap-start overflow-hidden rounded-2xl border border-stone-200 bg-white transition hover:border-stone-300 hover:shadow-md"
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
