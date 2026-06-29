"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Calendar, MapPin, ArrowRight, CalendarPlus, Sparkles } from "lucide-react";

interface FeedEvent {
  eventId: string;
  title: string;
  date: string;
  location: string;
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

// Derive coarse "areas" from event locations so a shopper can scope to where
// they are. Lightweight precursor to real neighborhood scoping (Move 2).
function areaOf(loc: string): string | null {
  const t = loc.trim();
  if (!t) return null;
  // last comma-separated chunk tends to be the city/area
  const parts = t.split(",").map((s) => s.trim()).filter(Boolean);
  return (parts[parts.length - 1] || t).slice(0, 24);
}

export function HappeningThisWeek() {
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [area, setArea] = useState<string>("all");

  useEffect(() => {
    fetch("/api/events/feed")
      .then((r) => (r.ok ? r.json() : { events: [] }))
      .then((d) => setEvents(Array.isArray(d.events) ? d.events : []))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const areas = useMemo(() => {
    const set = new Map<string, number>();
    for (const e of events) {
      const a = areaOf(e.location);
      if (a) set.set(a, (set.get(a) ?? 0) + 1);
    }
    return [...set.entries()].sort((a, b) => b[1] - a[1]).map(([a]) => a).slice(0, 6);
  }, [events]);

  const shown = useMemo(
    () => (area === "all" ? events : events.filter((e) => areaOf(e.location) === area)).slice(0, 12),
    [events, area]
  );

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
          <h2 className="text-xl font-semibold tracking-tight text-stone-900">Happening this week</h2>
          <p className="text-sm text-stone-500">Local events near you — RSVP and show up.</p>
        </div>
        <Link href="/events?view=events" className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-indigo-700 hover:underline">
          See all <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {areas.length > 1 && (
        <div className="mb-3 -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          <AreaPill label="All areas" active={area === "all"} onClick={() => setArea("all")} />
          {areas.map((a) => (
            <AreaPill key={a} label={a} active={area === a} onClick={() => setArea(a)} />
          ))}
        </div>
      )}

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
    </section>
  );
}

function AreaPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition ${
        active ? "bg-stone-900 text-white" : "border border-stone-200 bg-white text-stone-600 hover:border-stone-300"
      }`}
    >
      {label}
    </button>
  );
}
