"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { CalendarDays, CalendarClock, MapPin, LayoutGrid, Map as MapIcon } from "lucide-react";
import type { FeedEvent } from "@/app/api/events/feed/route";
import { EventsMap, type MapEvent } from "./EventsMap";

// Parse an event's day to LOCAL midnight ms. A "YYYY-MM-DD" string is parsed in
// local time (Date.parse treats it as UTC, which shifts the day across zones).
function parseEventDayMs(s: string): number {
  if (!s) return NaN;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime();
  const t = Date.parse(s);
  if (Number.isNaN(t)) return NaN;
  const d = new Date(t);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

// Demo events with dates floating relative to now: a couple today (happening
// now) + several upcoming, so both sections populate before real data exists.
function buildDemoEvents(now: number): FeedEvent[] {
  const day = 86_400_000;
  const iso = (ms: number) => {
    const d = new Date(ms);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const pretty = (ms: number, time: string) =>
    `${new Date(ms).toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" })} · ${time}`;
  const seed: Array<{ d: number; t: string; e: Omit<FeedEvent, "date" | "eventDate"> }> = [
    { d: 0, t: "10am – 4pm", e: { eventId: "demo-ev-1", title: "Mission Night Market", location: "Valencia St", city: "San Francisco", neighborhood: "Mission", description: "", image: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800", memberId: "", memberName: "SF Markets Co" } },
    { d: 0, t: "6pm – 9pm", e: { eventId: "demo-ev-2", title: "Rooftop Sound Session", location: "SoMa", city: "San Francisco", neighborhood: "SoMa", description: "", image: "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=800", memberId: "", memberName: "Bayview Collective" } },
    { d: 2, t: "11am – 2pm", e: { eventId: "demo-ev-3", title: "Maker's Craft Fair", location: "Oakland", city: "Oakland", neighborhood: "Temescal", description: "", image: "https://images.unsplash.com/photo-1556761175-b413da4baf72?w=800", memberId: "", memberName: "East Bay Makers" } },
    { d: 5, t: "5pm – 8pm", e: { eventId: "demo-ev-4", title: "Community Garden Potluck", location: "Berkeley", city: "Berkeley", neighborhood: "", description: "", image: "https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?w=800", memberId: "", memberName: "Greenhouse Project" } },
    { d: 9, t: "7pm – 10pm", e: { eventId: "demo-ev-5", title: "Local Film Premiere", location: "Mission", city: "San Francisco", neighborhood: "Mission", description: "", image: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800", memberId: "", memberName: "Indie SF" } },
  ];
  return seed.map(({ d, t, e }) => {
    const ms = now + d * day;
    return { ...e, eventDate: iso(ms), date: pretty(ms, t) };
  });
}

// Normal community events shown below the venue "what's on right now" feed,
// split into Happening today and Upcoming, each with place filter tags.
export function CommunityEventsLive() {
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [nowTs, setNowTs] = useState(0);
  const [nowPlace, setNowPlace] = useState("all");
  const [upPlace, setUpPlace] = useState("all");
  const [view, setView] = useState<"feed" | "map">("feed");

  useEffect(() => {
    const ref = Date.now();
    setNowTs(ref);
    let cancelled = false;
    fetch("/api/events/feed")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        // Fall back to demo events (floating relative to now) so the section
        // looks alive before any real vendor_events exist.
        setEvents(d.events?.length ? d.events : buildDemoEvents(ref));
      })
      .catch(() => { if (!cancelled) setEvents(buildDemoEvents(ref)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Classify by calendar day: today = happening now, future = upcoming, past
  // dropped. Unparseable dates fall into upcoming so nothing useful disappears.
  const { now, upcoming } = useMemo(() => {
    const ref = nowTs || Date.now();
    const today = new Date(ref);
    const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    const nowArr: FeedEvent[] = [];
    const upArr: FeedEvent[] = [];
    for (const e of events) {
      const ms = parseEventDayMs(e.eventDate);
      if (Number.isNaN(ms)) { upArr.push(e); continue; }
      if (ms === todayMid) nowArr.push(e);
      else if (ms > todayMid) upArr.push(e);
      // else: past — drop
    }
    upArr.sort((a, b) => (parseEventDayMs(a.eventDate) || Infinity) - (parseEventDayMs(b.eventDate) || Infinity));
    return { now: nowArr, upcoming: upArr };
  }, [events, nowTs]);

  const placeOf = (e: FeedEvent) => (e.city || e.neighborhood || "").trim();
  const placesOf = (arr: FeedEvent[]) =>
    Array.from(new Set(arr.map(placeOf).filter(Boolean))).sort();

  const nowPlaces = useMemo(() => placesOf(now), [now]);
  const upPlaces = useMemo(() => placesOf(upcoming), [upcoming]);

  const nowFiltered = nowPlace === "all" ? now : now.filter((e) => placeOf(e) === nowPlace);
  const upFiltered = upPlace === "all" ? upcoming : upcoming.filter((e) => placeOf(e) === upPlace);

  const mapEvents: MapEvent[] = useMemo(
    () => [
      ...now.map((e) => ({ ...e, live: true })),
      ...upcoming.map((e) => ({ ...e, live: false })),
    ],
    [now, upcoming]
  );

  if (loading) return null;
  if (now.length === 0 && upcoming.length === 0) return null;

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 pb-20 md:px-8">
      {/* Section header + Feed/Map toggle */}
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-stone-900">Community events</h2>
        <div className="flex rounded-full border border-stone-200 bg-white p-1">
          <button
            onClick={() => setView("feed")}
            className={
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition " +
              (view === "feed" ? "bg-stone-900 text-white" : "text-stone-600 hover:text-stone-900")
            }
          >
            <LayoutGrid className="h-4 w-4" /> Feed
          </button>
          <button
            onClick={() => setView("map")}
            className={
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition " +
              (view === "map" ? "bg-stone-900 text-white" : "text-stone-600 hover:text-stone-900")
            }
          >
            <MapIcon className="h-4 w-4" /> Map
          </button>
        </div>
      </div>

      {view === "map" ? (
        <EventsMap events={mapEvents} />
      ) : (
        <div className="space-y-10">
      {/* Happening today */}
      {now.length > 0 && (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-emerald-500" />
            <h2 className="text-lg font-semibold text-stone-900">Events happening now</h2>
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-600">
              {now.length}
            </span>
          </div>
          {nowPlaces.length > 0 && (
            <PlaceTags places={nowPlaces} active={nowPlace} onPick={setNowPlace} allCount={now.length} />
          )}
          <EventGrid items={nowFiltered} />
        </section>
      )}

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-sky-500" />
            <h2 className="text-lg font-semibold text-stone-900">Upcoming events</h2>
            <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-600">
              {upcoming.length}
            </span>
          </div>
          {upPlaces.length > 0 && (
            <PlaceTags places={upPlaces} active={upPlace} onPick={setUpPlace} allCount={upcoming.length} />
          )}
          <EventGrid items={upFiltered} />
        </section>
      )}
        </div>
      )}
    </div>
  );
}

function PlaceTags({
  places, active, onPick, allCount,
}: {
  places: string[];
  active: string;
  onPick: (p: string) => void;
  allCount: number;
}) {
  return (
    <div className="mb-3 -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <Tag active={active === "all"} onClick={() => onPick("all")}>
        All ({allCount})
      </Tag>
      {places.map((p) => (
        <Tag key={p} active={active === p} onClick={() => onPick(p)}>
          {p}
        </Tag>
      ))}
    </div>
  );
}

function Tag({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={
        "shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition " +
        (active ? "bg-stone-900 text-white" : "border border-stone-200 bg-white text-stone-700 hover:border-stone-300")
      }
    >
      {children}
    </button>
  );
}

function EventGrid({ items }: { items: FeedEvent[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-stone-400">No events match that place.</p>;
  }
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((e) => (
        <Link
          key={e.eventId}
          href={`/events/${e.eventId}`}
          className="group overflow-hidden rounded-2xl border border-stone-200 bg-white transition hover:border-stone-300 hover:shadow-sm"
        >
          <div className="relative aspect-[16/9] bg-stone-100">
            {e.image ? (
              <Image src={e.image} alt={e.title} fill sizes="(max-width:640px) 100vw, 33vw" className="object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-stone-100 to-stone-200">
                <CalendarDays className="h-8 w-8 text-stone-300" />
              </div>
            )}
          </div>
          <div className="p-4">
            <h3 className="truncate text-sm font-semibold text-stone-900">{e.title}</h3>
            {e.date && <p className="mt-0.5 text-xs font-medium text-stone-500">{e.date}</p>}
            {(e.location || e.city || e.neighborhood) && (
              <p className="mt-1 flex items-center gap-1 truncate text-xs text-stone-500">
                <MapPin className="h-3 w-3 shrink-0" />
                {[e.location, e.city || e.neighborhood].filter(Boolean).join(" · ")}
              </p>
            )}
            <p className="mt-1 text-xs text-stone-400">by {e.memberName}</p>
          </div>
        </Link>
      ))}
    </div>
  );
}
