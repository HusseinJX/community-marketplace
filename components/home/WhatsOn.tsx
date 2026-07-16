"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import Image from "next/image";
import { LayoutGrid, Map as MapIcon, CalendarDays, MapPin } from "lucide-react";
import { useBroadcasts, useEventsFeed } from "@/lib/data-hooks";
import { isLive, eventLabel, timeLeftLabel } from "@/lib/live-events";
import { themeOf } from "@/lib/event-themes";
import type { FeedEvent } from "@/app/api/events/feed/route";
import type { LiveBroadcast } from "@/components/live/types";

// "What's on" — ONE surface.
//
// This used to be two stacked products: LiveFeed (venues live now, with its own
// event chips, team chips and Feed/Map toggle) followed by CommunityEventsLive
// (events, with its OWN place filters and its OWN Feed/Map toggle). Two headers,
// two filter systems, two maps — you scrolled and hit what felt like a second
// app.
//
// Now it's one time-ordered stream: Happening now → Today → This weekend →
// Upcoming. A live venue broadcast and an event are just cards in the same list,
// with ONE filter row and ONE map.

const WhatsOnMapInner = dynamic(() => import("./WhatsOnMapInner"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[520px] items-center justify-center rounded-2xl border border-stone-200 bg-stone-50 text-sm text-stone-400">
      Loading map…
    </div>
  ),
});

// Parse an event's day to LOCAL midnight ms. (A "YYYY-MM-DD" string parsed with
// Date.parse is treated as UTC, which shifts the day across timezones.)
function dayMs(s: string): number {
  if (!s) return NaN;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime();
  const t = Date.parse(s);
  if (Number.isNaN(t)) return NaN;
  const d = new Date(t);
  // Human dates often omit the year ("Friday, Jul 25") and JS defaults to 2001,
  // which would wrongly file upcoming events as past.
  if (!/\d{4}/.test(s)) {
    const now = new Date();
    const todayMid = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    let year = now.getFullYear();
    if (new Date(year, d.getMonth(), d.getDate()).getTime() < todayMid - 180 * 86_400_000) year += 1;
    return new Date(year, d.getMonth(), d.getDate()).getTime();
  }
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

type Bucket = "now" | "today" | "weekend" | "upcoming";

const BUCKET_LABEL: Record<Bucket, string> = {
  now: "Happening now",
  today: "Today",
  weekend: "This weekend",
  upcoming: "Upcoming",
};

export function WhatsOn() {
  const { broadcasts, loading: bLoading } = useBroadcasts();
  const { events, loading: eLoading } = useEventsFeed();
  const [view, setView] = useState<"feed" | "map">("feed");
  const [tag, setTag] = useState("all");
  // Time-dependent bucketing must not run during SSR (hydration mismatch).
  const [nowTs, setNowTs] = useState(0);
  useEffect(() => setNowTs(Date.now()), []);

  const liveNow = useMemo(
    () => (nowTs ? broadcasts.filter((b) => isLive(b, nowTs)) : []),
    [broadcasts, nowTs],
  );

  // Events, filed by when they are.
  const byBucket = useMemo(() => {
    const out: Record<Exclude<Bucket, "now">, FeedEvent[]> = { today: [], weekend: [], upcoming: [] };
    if (!nowTs) return out;
    const d = new Date(nowTs);
    const todayMid = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    // The coming Sat + Sun (if today IS the weekend, those days are "today"/"upcoming").
    const dow = d.getDay(); // 0 Sun … 6 Sat
    const satMs = todayMid + ((6 - dow + 7) % 7) * 86_400_000;
    const sunMs = todayMid + ((7 - dow) % 7) * 86_400_000;

    for (const e of events) {
      const ms = dayMs(e.eventDate);
      if (Number.isNaN(ms)) { out.upcoming.push(e); continue; }
      if (ms < todayMid) continue; // past
      if (ms === todayMid) out.today.push(e);
      else if (ms === satMs || ms === sunMs) out.weekend.push(e);
      else out.upcoming.push(e);
    }
    for (const k of ["today", "weekend", "upcoming"] as const) {
      out[k].sort((a, b) => (dayMs(a.eventDate) || Infinity) - (dayMs(b.eventDate) || Infinity));
    }
    return out;
  }, [events, nowTs]);

  // ONE filter row, over both kinds: live venues carry their event ("World Cup"),
  // events carry their theme ("Markets", "Music").
  const tags = useMemo(() => {
    const set = new Set<string>();
    for (const b of liveNow) set.add(eventLabel(b.event_slug));
    for (const list of [byBucket.today, byBucket.weekend, byBucket.upcoming])
      for (const e of list) set.add(themeOf(e));
    return Array.from(set).filter(Boolean).sort();
  }, [liveNow, byBucket]);

  const matchB = (b: LiveBroadcast) => tag === "all" || eventLabel(b.event_slug) === tag;
  const matchE = (e: FeedEvent) => tag === "all" || themeOf(e) === tag;

  const shownLive = liveNow.filter(matchB);
  const shownToday = byBucket.today.filter(matchE);
  const shownWeekend = byBucket.weekend.filter(matchE);
  const shownUpcoming = byBucket.upcoming.filter(matchE);

  const loading = bLoading || eLoading || nowTs === 0;
  const empty =
    !loading &&
    shownLive.length === 0 &&
    shownToday.length === 0 &&
    shownWeekend.length === 0 &&
    shownUpcoming.length === 0;

  return (
    <div className="mx-auto max-w-6xl px-4 pt-5 md:px-8">
      {/* One header, one toggle */}
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold tracking-tight text-stone-900">What&apos;s on</h2>
        <div className="inline-flex rounded-full bg-stone-100 p-1">
          {([["feed", LayoutGrid], ["map", MapIcon]] as const).map(([k, Icon]) => (
            <button
              key={k}
              onClick={() => setView(k)}
              aria-pressed={view === k}
              aria-label={k === "feed" ? "Feed view" : "Map view"}
              className={
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold transition " +
                (view === k ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-800")
              }
            >
              <Icon className="h-3.5 w-3.5" />
              {k === "feed" ? "Feed" : "Map"}
            </button>
          ))}
        </div>
      </div>

      {/* One filter row */}
      {tags.length > 0 && (
        <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
          {["all", ...tags].map((t) => (
            <button
              key={t}
              onClick={() => setTag(t)}
              className={
                "shrink-0 rounded-full px-3 py-1.5 text-[13px] font-medium transition " +
                (tag === t ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200")
              }
            >
              {t === "all" ? "All" : t}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <p className="py-16 text-center text-sm text-stone-400">Loading…</p>
      ) : view === "map" ? (
        <div className="mt-4">
          <WhatsOnMapInner
            broadcasts={shownLive}
            events={[...shownToday, ...shownWeekend, ...shownUpcoming]}
          />
        </div>
      ) : empty ? (
        <p className="py-16 text-center text-sm text-stone-400">
          Nothing on right now. Check back tonight.
        </p>
      ) : (
        <div className="mt-5 space-y-8">
          {shownLive.length > 0 && (
            <Section bucket="now" count={shownLive.length}>
              {shownLive.map((b) => (
                <LiveCard key={b.id} b={b} />
              ))}
            </Section>
          )}
          {shownToday.length > 0 && (
            <Section bucket="today" count={shownToday.length}>
              {shownToday.map((e) => (
                <EventCard key={e.eventId} e={e} />
              ))}
            </Section>
          )}
          {shownWeekend.length > 0 && (
            <Section bucket="weekend" count={shownWeekend.length}>
              {shownWeekend.map((e) => (
                <EventCard key={e.eventId} e={e} />
              ))}
            </Section>
          )}
          {shownUpcoming.length > 0 && (
            <Section bucket="upcoming" count={shownUpcoming.length}>
              {shownUpcoming.map((e) => (
                <EventCard key={e.eventId} e={e} />
              ))}
            </Section>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ bucket, count, children }: { bucket: Bucket; count: number; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        {bucket === "now" && <span className="h-2 w-2 animate-pulse rounded-full bg-rose-500" />}
        <h3 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
          {BUCKET_LABEL[bucket]}
        </h3>
        <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-500">{count}</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </section>
  );
}

// A venue broadcasting right now.
function LiveCard({ b }: { b: LiveBroadcast }) {
  const cover = b.image_urls?.[0] ?? null;
  return (
    <Link href={`/live/${b.id}`} className="card-soft card-hover flex h-full flex-col overflow-hidden">
      <div className="relative aspect-[16/9] bg-stone-100">
        {cover ? (
          <Image src={cover} alt={b.member_name ?? ""} fill sizes="(max-width:640px) 90vw, 320px" className="object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-stone-100 text-3xl">
            {b.whats_on ? "📺" : "📍"}
          </div>
        )}
        <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> Live
        </span>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h4 className="truncate text-sm font-semibold text-stone-900">{b.member_name}</h4>
        <p className="mt-0.5 truncate text-xs text-stone-600">{b.whats_on || eventLabel(b.event_slug)}</p>
        <div className="mt-auto flex items-center justify-between gap-2 pt-2 text-xs text-stone-400">
          <span className="truncate">{b.supports_team ? `🏳️ ${b.supports_team}` : eventLabel(b.event_slug)}</span>
          {b.ends_at && <span className="shrink-0 font-medium text-rose-600">{timeLeftLabel(b.ends_at)}</span>}
        </div>
      </div>
    </Link>
  );
}

// An event — with the collaborator stack, so the teamwork is visible.
function EventCard({ e }: { e: FeedEvent }) {
  const shown = e.collaboratorList.slice(0, 4);
  const overflow = e.collaborators - shown.length;
  return (
    <Link href={`/events/${e.eventId}`} className="card-soft card-hover flex h-full flex-col overflow-hidden">
      <div className="relative aspect-[16/9] bg-stone-100">
        {e.image ? (
          <Image src={e.image} alt={e.title} fill sizes="(max-width:640px) 90vw, 320px" className="object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <CalendarDays className="h-8 w-8 text-stone-300" />
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h4 className="truncate text-sm font-semibold text-stone-900">{e.title}</h4>
        {e.date && <p className="mt-0.5 truncate text-xs font-medium text-stone-500">{e.date}</p>}
        {(e.location || e.city || e.neighborhood) && (
          <p className="mt-1 flex items-center gap-1 truncate text-xs text-stone-500">
            <MapPin className="h-3 w-3 shrink-0" />
            {[e.location, e.city || e.neighborhood].filter(Boolean).join(" · ")}
          </p>
        )}
        <div className="mt-auto pt-2">
          {e.collaborators > 1 ? (
            <div className="flex items-center gap-2">
              <span className="flex -space-x-1.5">
                {shown.map((m, i) => (
                  <span
                    key={`${m.id}-${i}`}
                    title={m.name ?? undefined}
                    className="grid h-6 w-6 place-items-center rounded-full border border-white bg-stone-100 text-[10px] font-semibold uppercase text-stone-600"
                  >
                    {(m.name ?? "?").trim().charAt(0)}
                  </span>
                ))}
                {overflow > 0 && (
                  <span className="grid h-6 w-6 place-items-center rounded-full border border-white bg-stone-100 text-[10px] font-semibold text-stone-500">
                    +{overflow}
                  </span>
                )}
              </span>
              <span className="truncate text-xs text-stone-500">{e.collaborators} teamed up</span>
            </div>
          ) : (
            <p className="truncate text-xs text-stone-400">by {e.memberName}</p>
          )}
        </div>
      </div>
    </Link>
  );
}
