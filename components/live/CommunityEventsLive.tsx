"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { CalendarDays, CalendarClock, MapPin } from "lucide-react";
import type { FeedEvent } from "@/app/api/events/feed/route";
import { groupEventsByTheme } from "@/lib/event-themes";

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
    { d: 6, t: "1pm – 4pm", e: { eventId: "demo-ev-6", title: "Watercolor Workshop", location: "Hayes Valley", city: "San Francisco", neighborhood: "Hayes Valley", description: "Beginner-friendly painting class", image: "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=800", memberId: "", memberName: "Studio Nine" } },
    { d: 11, t: "12pm – 6pm", e: { eventId: "demo-ev-7", title: "Taco & Wine Tasting", location: "Napa", city: "Napa", neighborhood: "", description: "Food and drink pairing afternoon", image: "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=800", memberId: "", memberName: "Valley Eats" } },
  ];
  return seed.map(({ d, t, e }) => {
    const ms = now + d * day;
    return { ...e, eventDate: iso(ms), date: pretty(ms, t) };
  });
}

// Community events split into Happening now and Upcoming. Both render as
// horizontal scroll rails; upcoming is grouped into themed rails (Markets,
// Music, Food, etc.). `only` renders just one section.
export function CommunityEventsLive({ only }: { only?: "now" | "upcoming" } = {}) {
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [nowTs, setNowTs] = useState(0);

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

  const themed = useMemo(() => groupEventsByTheme(upcoming), [upcoming]);

  if (loading) return null;

  const showNow = only !== "upcoming" && now.length > 0;
  const showUpcoming = only !== "now" && upcoming.length > 0;
  if (!showNow && !showUpcoming) return null;

  return (
    <div className="mx-auto max-w-6xl space-y-10 px-4 md:px-8">
      {only === undefined && (
        <h2 className="text-xl font-semibold tracking-tight text-stone-900">Community events</h2>
      )}

      {showNow && (
        <section>
          <SectionHead
            icon={<CalendarDays className="h-5 w-5 text-emerald-500" />}
            title="Happening now"
            count={now.length}
            countClass="bg-emerald-100 text-emerald-600"
          />
          <EventRail items={now} live />
        </section>
      )}

      {showUpcoming && (
        <section className="space-y-8">
          <SectionHead
            icon={<CalendarClock className="h-5 w-5 text-sky-500" />}
            title="Upcoming events"
            count={upcoming.length}
            countClass="bg-sky-100 text-sky-600"
          />
          {themed.map((g) => (
            <div key={g.key}>
              <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold tracking-tight text-stone-900">
                <span className="text-xl leading-none">{g.emoji}</span>
                {g.label}
                <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-500">
                  {g.items.length}
                </span>
              </h3>
              <EventRail items={g.items} />
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

function SectionHead({
  icon, title, count, countClass,
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
  countClass: string;
}) {
  return (
    <div className="mb-3 flex items-center gap-2">
      {icon}
      <h2 className="text-lg font-semibold tracking-tight text-stone-900">{title}</h2>
      <span className={"rounded-full px-2 py-0.5 text-xs font-medium " + countClass}>{count}</span>
    </div>
  );
}

// Horizontal scroll of event cards.
function EventRail({ items, live = false }: { items: FeedEvent[]; live?: boolean }) {
  return (
    <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:-mx-8 md:px-8">
      {items.map((e) => (
        <div key={e.eventId} className="w-72 shrink-0 sm:w-80">
          <EventCard e={e} live={live} />
        </div>
      ))}
    </div>
  );
}

function EventCard({ e, live = false }: { e: FeedEvent; live?: boolean }) {
  return (
    <Link
      href={`/events/${e.eventId}`}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white transition hover:border-stone-300 hover:shadow-sm"
    >
      <div className="relative aspect-[16/9] bg-stone-100">
        {e.image ? (
          <Image src={e.image} alt={e.title} fill sizes="(max-width:640px) 80vw, 320px" className="object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-stone-100 to-stone-200">
            <CalendarDays className="h-8 w-8 text-stone-300" />
          </div>
        )}
        {live && (
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
            Today
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="truncate text-sm font-semibold text-stone-900">{e.title}</h3>
        {e.date && <p className="mt-0.5 text-xs font-medium text-stone-500">{e.date}</p>}
        {(e.location || e.city || e.neighborhood) && (
          <p className="mt-1 flex items-center gap-1 truncate text-xs text-stone-500">
            <MapPin className="h-3 w-3 shrink-0" />
            {[e.location, e.city || e.neighborhood].filter(Boolean).join(" · ")}
          </p>
        )}
        <p className="mt-auto pt-2 text-xs text-stone-400">by {e.memberName}</p>
      </div>
    </Link>
  );
}
