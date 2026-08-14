"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { CalendarDays, MapPin, Star, X } from "lucide-react";
import type { FeedEvent } from "@/app/api/events/feed/route";
import { groupEventsByTheme, themeOf } from "@/lib/event-themes";
import { useEventsFeed, useSavedEvents } from "@/lib/data-hooks";
import { SaveEventButton } from "@/components/events/SaveEventButton";
import { RailHeader } from "@/components/home/RailHeader";
import { CategorySplit } from "@/components/home/CategorySplit";
import { eventEmojiFor } from "@/lib/map-adapters";

// Parse an event's day to LOCAL midnight ms. A "YYYY-MM-DD" string is parsed in
// local time (Date.parse treats it as UTC, which shifts the day across zones).
function parseEventDayMs(s: string): number {
  if (!s) return NaN;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime();
  const t = Date.parse(s);
  if (Number.isNaN(t)) return NaN;
  const d = new Date(t);
  // Human date strings often omit the year (e.g. "Friday, Jul 25"), and JS then
  // defaults it to 2001 — which would wrongly classify upcoming events as past.
  // When the string has no explicit 4-digit year, assume the current year, and
  // roll to next year if that day is already well behind us (Dec→Jan wrap).
  if (!/\d{4}/.test(s)) {
    const now = new Date();
    const todayMid = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    let year = now.getFullYear();
    if (new Date(year, d.getMonth(), d.getDate()).getTime() < todayMid - 180 * 86_400_000) year += 1;
    return new Date(year, d.getMonth(), d.getDate()).getTime();
  }
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

// Community events split into Happening now and Upcoming. Both render as
// horizontal scroll rails; upcoming is grouped into themed rails (Markets,
// Music, Food, etc.). `only` renders just one section.
export function CommunityEventsLive({
  only,
  // The home Events tab already says "Events near you" directly above this, so
  // its own heading would be the second title in a row saying the same thing.
  hideHeading,
}: { only?: "now" | "upcoming"; hideHeading?: boolean } = {}) {
  const [nowTs, setNowTs] = useState(0);
  useEffect(() => { setNowTs(Date.now()); }, []);

  // ONE filter row over both sections, the same shape What's on uses: the
  // themes this feed actually contains, plus a Saved chip. Derived from the
  // events in hand rather than a fixed list, so a theme with nothing in it is
  // never offered — an empty filter is a dead control.
  const [tag, setTag] = useState("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [savedOnly, setSavedOnly] = useState(false);
  const { saved } = useSavedEvents();

  // Shared, cached feed (same key as CommunityFeed — deduped, survives nav).
  const { events, loading: feedLoading } = useEventsFeed();

  // Real events only — no demo filler. When there's nothing (or nothing
  // upcoming), the relevant section simply doesn't render (see below).
  const loading = feedLoading || nowTs === 0;

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

  const tags = useMemo(() => {
    const set = new Set<string>();
    for (const e of [...now, ...upcoming]) set.add(themeOf(e));
    return [...set].filter(Boolean).sort();
  }, [now, upcoming]);

  const match = useCallback(
    (e: FeedEvent) =>
      (tag === "all" || themeOf(e) === tag) && (!savedOnly || saved.has(e.eventId)),
    [tag, savedOnly, saved],
  );

  const shownNow = useMemo(() => now.filter(match), [now, match]);
  const shownUpcoming = useMemo(() => upcoming.filter(match), [upcoming, match]);
  const themed = useMemo(() => groupEventsByTheme(shownUpcoming), [shownUpcoming]);

  // Which theme is expanded into the list+map split, by group key. Same
  // interaction as the Shops rails — see components/home/CategorySplit.
  const openTheme = expanded ? themed.find((g) => g.key === expanded) : undefined;

  if (loading) return null;

  if (openTheme) {
    const byId = new Map(openTheme.items.map((e) => [e.eventId, e]));
    return (
      <CategorySplit
        label={openTheme.label}
        emoji={openTheme.emoji}
        backLabel="All events"
        ids={openTheme.items.map((e) => e.eventId)}
        // Events without a fix (connector events carry none) stay in the LIST
        // and are simply absent from the map. Dropping them from both would
        // hide real events because we don't know where they are.
        points={openTheme.items.flatMap((e) =>
          e.lat != null && e.lng != null
            ? [{
                id: e.eventId,
                lat: e.lat,
                lng: e.lng,
                emoji: eventEmojiFor(`${e.title} ${openTheme.label}`),
                title: e.title,
              }]
            : [],
        )}
        renderCard={(id) => {
          const e = byId.get(id);
          return e ? <EventCard key={id} e={e} /> : null;
        }}
        onBack={() => setExpanded(null)}
      />
    );
  }

  const showNow = only !== "upcoming" && shownNow.length > 0;
  const showUpcoming = only !== "now" && shownUpcoming.length > 0;
  // Only bail out entirely when there is nothing to filter. With a filter on
  // and no matches, the row has to stay — otherwise the controls vanish along
  // with the results and there is no way back.
  const anything = now.length > 0 || upcoming.length > 0;
  if (!anything) return null;

  return (
    <div className="mx-auto max-w-6xl space-y-10 px-4 md:px-8">
      {only === undefined && !hideHeading && (
        <h2 className="text-xl font-semibold tracking-tight text-stone-900">Upcoming events</h2>
      )}

      {/* Filters. `only` is a slice of this list embedded elsewhere, so it
          keeps the plain rails and no controls. */}
      {only === undefined && (tags.length > 1 || saved.size > 0) && (
        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden">
          {(tag !== "all" || savedOnly) && (
            <button
              onClick={() => { setTag("all"); setSavedOnly(false); }}
              aria-label="Clear filters"
              className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-rose-300 bg-rose-50 px-3 py-1.5 text-[13px] font-medium text-rose-600 transition hover:bg-rose-100"
            >
              <X className="h-4 w-4" />
              Clear
            </button>
          )}
          {saved.size > 0 && (
            <button
              onClick={() => setSavedOnly((v) => !v)}
              aria-pressed={savedOnly}
              className={
                "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium transition " +
                (savedOnly ? "bg-amber-500 text-white" : "bg-amber-50 text-amber-700 hover:bg-amber-100")
              }
            >
              <Star className={"h-3.5 w-3.5 " + (savedOnly ? "fill-white" : "fill-amber-500 text-amber-500")} />
              Saved
              <span className={savedOnly ? "text-white/80" : "text-amber-600/70"}>{saved.size}</span>
            </button>
          )}
          {["all", ...tags].map((t) => (
            <button
              key={t}
              onClick={() => setTag(t)}
              aria-pressed={tag === t}
              className={
                "shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-[13px] font-medium transition " +
                (tag === t ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200")
              }
            >
              {t === "all" ? "All" : t}
            </button>
          ))}
        </div>
      )}

      {!showNow && !showUpcoming && (
        <p className="py-10 text-center text-sm text-stone-400">
          Nothing matches that filter.
        </p>
      )}

      {showNow && (
        <section>
          <SectionHead
            icon={<CalendarDays className="h-5 w-5 text-emerald-500" />}
            title="Happening now"
            count={shownNow.length}
            countClass="bg-emerald-100 text-emerald-600"
          />
          <EventRail items={shownNow} live />
        </section>
      )}

      {showUpcoming && (
        <section className="space-y-8">
          {themed.map((g) => (
            <ThemeRail
              key={g.key}
              emoji={g.emoji}
              label={g.label}
              items={g.items}
              onExpand={() => {
                setExpanded(g.key);
                window.scrollTo({ top: 0 });
              }}
            />
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

/**
 * One theme, as a rail you can open.
 *
 * Shares RailHeader with the Shops directory, so the expand affordance and the
 * scroll arrows are one implementation rather than two that drift.
 */
function ThemeRail({
  emoji,
  label,
  items,
  onExpand,
}: {
  emoji: string;
  label: string;
  items: FeedEvent[];
  onExpand: () => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  return (
    <div>
      <RailHeader
        emoji={emoji}
        label={label}
        count={items.length}
        scrollerRef={scroller}
        onExpand={onExpand}
      />
      <div
        ref={scroller}
        className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:-mx-8 md:px-8"
      >
        {items.map((e) => (
          <div key={e.eventId} className="w-72 shrink-0 sm:w-80">
            <EventCard e={e} />
          </div>
        ))}
      </div>
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
        {/* Saving works on every other event surface; these cards were the one
            place you could see an event and not keep it. Right corner — the
            "Today" flag owns the left. */}
        <SaveEventButton eventId={e.eventId} corner="right" />
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
        <div className="mt-auto pt-2">
          {e.collaborators > 1 ? (
            <CollaboratorStack list={e.collaboratorList} count={e.collaborators} />
          ) : (
            <p className="truncate text-xs text-stone-400">by {e.memberName}</p>
          )}
        </div>
      </div>
    </Link>
  );
}

// Makes the collaboration visible to shoppers: overlapping initials for the host
// + accepted lineup, then "N teamed up". Not links — the whole card is already
// an anchor, and nesting anchors is invalid.
function CollaboratorStack({
  list,
  count,
}: {
  list: FeedEvent["collaboratorList"];
  count: number;
}) {
  const shown = list.slice(0, 4);
  const overflow = count - shown.length;
  return (
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
      <span className="truncate text-xs text-stone-500">{count} teamed up</span>
    </div>
  );
}
