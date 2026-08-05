"use client";

// "Tell it what you want, in your own words."
//
// The whole interaction is one text box. No form, no taxonomy to learn — a
// sentence like "chill stuff near me" or "I have a 4-year-old and no car"
// carries more about which events suit someone than any set of checkboxes.
// The chips below it are an escape hatch for people who'd rather tap, and a
// way to SEE what was understood from the sentence.
//
// Every reason on a card is a fact the event stated about itself. Never a
// reason inferred from a similarity score — that is how an earlier version
// told someone a job-hunting talk "matched your interest in art".

import { useEffect, useState } from "react";
import Link from "next/link";
import { MapPin, Loader2, X, LocateFixed, Clock, Building2 } from "lucide-react";
import { cachedPosition, getHomePosition, refreshHomePosition } from "@/lib/home-position";
import { usePersonalizedEvents } from "@/lib/data-hooks";

const TOPIC_CHIPS: { id: string; label: string }[] = [
  { id: "music", label: "Music" },
  { id: "kids-family", label: "Kids & family" },
  { id: "food-drink", label: "Food & drink" },
  { id: "visual-art", label: "Art" },
  { id: "books-writing", label: "Books" },
  { id: "outdoors-nature", label: "Outdoors" },
  { id: "tech", label: "Tech" },
  { id: "wellness", label: "Wellness" },
  { id: "comedy", label: "Comedy" },
  { id: "community-civic", label: "Community" },
];

// Example phrases used to sit under the box as tappable chips. Removed: they
// competed with the topic pills directly below for the same tap, and doubled
// the height of the controls before a single event was visible. The placeholder
// carries the same hint at no cost.

const RADIUS_STEPS = [0.5, 1, 2, 5, 10];

interface FeedEvent {
  id: string;
  title: string;
  date: string;
  time: string | null;
  venue: string | null;
  source: string;
  sourceId: string | null;
  image: string | null;
  free: boolean | null;
  miles: number | null;
  /** Minutes until it starts, city-local. Negative = under way. Null = not today. */
  startsInMin: number | null;
  /** Clock start as minutes since midnight — orders any day, not just today. */
  startMin: number | null;
  /** Under way right now, judged on the end time where the source gave one. */
  onNow: boolean;
  day: "today" | "tomorrow" | "later";
  why: string[];
  topics: string[];
}

/**
 * The "when" badge that sits beside the distance.
 *
 * Only says something when it is genuinely imminent. Beyond tomorrow the day
 * heading above the card already answers "when", and repeating it on every card
 * is noise pretending to be information.
 */
function whenBadge(
  e: FeedEvent,
  /** Minutes since the server measured these countdowns. */
  agedMin: number,
): { label: string; tone: "now" | "soon" | "next" | "past" } | null {
  if (e.day === "tomorrow") return { label: "Tomorrow", tone: "next" };
  if (e.day !== "today") return null;

  // Decided server-side against the event's own end time, in city hours.
  if (e.onNow) return { label: "On now", tone: "now" };

  // Age the server's countdown by how long this response has been on screen.
  // Without this a tab left open keeps promising "in 9m" an hour later.
  const m = e.startsInMin == null ? null : e.startsInMin - agedMin;
  // Today but no readable start time — "today" is all we can honestly say.
  if (m == null) return { label: "Today", tone: "next" };

  // Under way is already handled above, so a start in the past with no stated
  // end means exactly that: it began, and we cannot say whether it is over.
  if (m <= 0) return { label: "Started", tone: "past" };

  if (m < 60) return { label: `in ${m}m`, tone: "now" };
  const hours = Math.round(m / 60);
  return { label: `in ${hours}h`, tone: hours <= 3 ? "soon" : "next" };
}

interface Result {
  summary: string;
  parseFailed: boolean;
  facts: {
    topics: string[];
    energies: string[];
    childAges: number[];
    freeOnly: boolean | null;
    maxMiles: number | null;
    times: string[];
  };
  filtered: Record<string, number>;
  total: number;
  events: FeedEvent[];
  /** Epoch ms when the server measured `startsInMin`. */
  generatedAt?: number;
}

/** How many events one "screen" of the feed reveals. */
const PAGE = 60;

/** Local calendar date as `YYYY-MM-DD` (never UTC — toISOString shifts the day). */
function localISO(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * Compares CALENDAR DATES as strings, not timestamps.
 *
 * The arithmetic version built the event at noon and measured it against local
 * midnight — half a day apart, and Math.round(0.5) rounds *up*, so every one of
 * today's events sat under a "Tomorrow" heading while the cards beneath them
 * correctly said "today". Two dates either are the same day or they are not;
 * there is nothing here worth computing a difference for.
 */
function dayLabel(iso: string): string {
  const today = localISO(new Date());
  if (iso === today) return "Today";
  if (iso === localISO(new Date(Date.now() + 864e5))) return "Tomorrow";
  const d = new Date(iso + "T12:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export function PersonalizedEvents({
  // The SUBMITTED search text, owned by the page so the input can live in the
  // top search slot. Typing must never reach here — each miss with words in the
  // box costs a model call, so only a submit changes it.
  query = "",
  onClearQuery,
  onLoadingChange,
}: {
  query?: string;
  onClearQuery?: () => void;
  /** Lets the lifted search button show the feed's own loading state. */
  onLoadingChange?: (loading: boolean) => void;
} = {}) {
  const [topics, setTopics] = useState<string[]>([]);
  // Narrowed to one organiser, set by tapping their tag on any card.
  const [organizer, setOrganizer] = useState<string | null>(null);
  const [freeOnly, setFreeOnly] = useState(false);
  const [nearMe, setNearMe] = useState(false);
  const [radius, setRadius] = useState(2);
  const [home, setHome] = useState<{ lat: number; lng: number } | null>(cachedPosition);
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  // Location unavailable or refused — distances simply do not render.
  const [locationOff, setLocationOff] = useState(false);

  // The feed itself. SWR keyed on the request, so coming back to an unchanged
  // feed paints from cache with no network at all, and every filter combination
  // keeps its own cached answer.
  const { data: result, loading, error } = usePersonalizedEvents({
    text: query,
    topics,
    freeOnly,
    organizer,
    lat: home?.lat ?? null,
    lng: home?.lng ?? null,
    // Only send a radius when "near me" is on AND we have an origin — a
    // distance filter without a location silently empties the feed.
    maxMiles: nearMe && home ? radius : null,
  }) as { data: Result | undefined; loading: boolean; error: Error | undefined };

  // The search button lives a level up now, so it has to be told when the feed
  // is working or "Go" would look inert while the request is in flight.
  useEffect(() => {
    onLoadingChange?.(loading);
  }, [loading, onLoadingChange]);

  // Let the countdowns age themselves instead of refetching to refresh them.
  // A tab left open used to sit on "in 9m" indefinitely; polling would fix that
  // at the price of a model call every few minutes, which the once-per-item
  // rule exists to prevent. Ageing is free and cannot fail.
  //
  // Elapsed time is measured entirely inside this browser: `start` is captured
  // in the effect and compared against the same clock. Never server-time minus
  // client-time — a phone whose clock is off by an hour would read that offset
  // as an hour of elapsed time and declare tonight over. Only the ABSOLUTE
  // countdown comes from the server, which is precisely why it is computed there.
  const generatedAt = result?.generatedAt;
  const [aged, setAged] = useState<{ gen: number | undefined; n: number }>({
    gen: undefined,
    n: 0,
  });
  useEffect(() => {
    const start = Date.now();
    const id = window.setInterval(
      () => setAged({ gen: generatedAt, n: Math.floor((Date.now() - start) / 60_000) }),
      30_000,
    );
    return () => window.clearInterval(id);
  }, [generatedAt]);
  // A fresh response resets the age by comparison rather than by writing, so
  // new countdowns are never shown pre-aged while waiting for the next tick.
  const agedMin = aged.gen === generatedAt ? aged.n : 0;

  // How much of the ranked feed is revealed. Tied to the query rather than
  // reset by an effect, so a narrower search can never paint one frame of the
  // old scroll depth before snapping back to the first screen.
  const feedKey = `${query}|${topics.join(",")}|${organizer ?? ""}|${freeOnly}|${nearMe ? radius : ""}`;
  const [reveal, setReveal] = useState<{ key: string; n: number }>({ key: feedKey, n: PAGE });
  const shown = reveal.key === feedKey ? reveal.n : PAGE;
  const showMore = () => setReveal({ key: feedKey, n: shown + PAGE });

  const all = result?.events ?? [];
  const visible = all.slice(0, shown);
  const more = all.length - visible.length;

  // Position comes from the shared home cache, which the city header above also
  // reads — one lookup, one permission dialog, one remembered fix.
  //
  // The feed does not wait on it: it renders immediately, then re-keys with
  // coordinates when they arrive, so distance is the default rather than
  // something to opt into. A refusal is not an error state.
  useEffect(() => {
    let cancelled = false;
    void getHomePosition().then((p) => {
      if (cancelled) return;
      if (p) setHome(p);
      else setLocationOff(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Every control below just sets state. The SWR key is derived from that
  // state, so changing a filter fetches (or reads cache) on its own — there is
  // no imperative "go and refetch" left to forget to call.
  async function useMyLocation() {
    setLocating(true);
    setGeoError(null);
    try {
      // Native-first (WKWebView has no navigator.geolocation), web fallback.
      // Refresh rather than read: this button exists because the person wants a
      // NEW fix, so a remembered one would be the wrong answer.
      setHome(await refreshHomePosition());
      setLocationOff(false);
      setNearMe(true);
    } catch {
      setGeoError("Couldn't get your location. Check location permissions.");
      setNearMe(false);
    } finally {
      setLocating(false);
    }
  }

  function toggleTopic(id: string) {
    setTopics(topics.includes(id) ? topics.filter((t) => t !== id) : [...topics, id]);
  }

  // Day buckets in CHRONOLOGICAL order, and SOONEST FIRST within each day.
  //
  // The list arrives sorted by score, which interleaves dates — so grouping
  // only consecutive runs produced repeating "Today / Tomorrow / Today"
  // headers, and the feed opened on whichever day happened to hold the single
  // top-scoring event. Someone scanning for something to do reads forward in
  // time, so time decides the order and the score only breaks ties.
  const byDay = new Map<string, FeedEvent[]>();
  for (const e of visible) {
    const list = byDay.get(e.date);
    if (list) list.push(e);
    else byDay.set(e.date, [e]);
  }

  /**
   * Sort key within a day. Lower sorts first.
   *
   * ON NOW LEADS. Something already under way is the most actionable thing on
   * the page — you can leave for it this minute — so it outranks a thing
   * starting in twenty. Then what is coming up, soonest first. Then anything
   * with no stated time, which we cannot place without inventing one. Then
   * what has finished, which stays visible only because an event with no end
   * time might not really be over.
   */
  const bands = (e: FeedEvent): [number, number] => {
    if (e.day === "today") {
      // Most recently started first: you have missed least of it.
      if (e.onNow) return [0, -(e.startsInMin ?? 0)];
      if (e.startsInMin != null && e.startsInMin > 0) return [1, e.startsInMin];
      return [2, 0]; // today, no stated time (or started with no stated end)
    }
    if (e.startMin != null) return [1, e.startMin]; // other days: by clock time
    return [2, 0];
  };

  const grouped: [string, FeedEvent[]][] = [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, evs]) => [
      day,
      [...evs].sort((a, b) => {
        const [ab, av] = bands(a);
        const [bb, bv] = bands(b);
        if (ab !== bb) return ab - bb;
        if (av !== bv) return av - bv;
        // Same time — the closer one wins.
        return (a.miles ?? Infinity) - (b.miles ?? Infinity);
      }),
    ]);

  const ruledOut = Object.entries(result?.filtered ?? {}).filter(([, n]) => n > 0);

  return (
    <div>
      {/* The search input lives in the page's top slot — see EventSearchBar. */}

      {/* ── filters ───────────────────────────────────────────────────────
          ONE horizontal scroll row, not a wrapping grid. Ten wrapped pills ate
          three lines of a phone screen before any event appeared; a single row
          keeps the feed above the fold and reads as "there are more that way".
          Negative margins let it bleed to the screen edge, which is the cue
          that it scrolls. */}
      <div className="-mx-4 mt-3 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
        {TOPIC_CHIPS.map((t) => {
          const on = topics.includes(t.id);
          return (
            <button
              key={t.id}
              onClick={() => toggleTopic(t.id)}
              aria-pressed={on}
              className={`shrink-0 whitespace-nowrap rounded-full border px-4 py-1.5 text-sm font-medium transition ${
                on
                  ? "border-stone-900 bg-stone-900 text-white"
                  : "border-stone-200 bg-white text-stone-600 hover:border-stone-400"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="-mx-4 mt-2 flex items-center gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
        <button
          onClick={() => {
            const next = !freeOnly;
            setFreeOnly(next);
          }}
          aria-pressed={freeOnly}
          className={`shrink-0 whitespace-nowrap rounded-full border px-4 py-1.5 text-sm font-medium ${
            freeOnly
              ? "border-emerald-600 bg-emerald-600 text-white"
              : "border-stone-200 bg-white text-stone-600 hover:border-stone-400"
          }`}
        >
          Free only
        </button>

        <button
          onClick={() => {
            if (!home) return void useMyLocation();
            const next = !nearMe;
            setNearMe(next);
          }}
          aria-pressed={nearMe}
          disabled={locating}
          className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-4 py-1.5 text-sm font-medium disabled:opacity-60 ${
            nearMe
              ? "border-indigo-600 bg-indigo-600 text-white"
              : "border-stone-200 bg-white text-stone-600 hover:border-stone-400"
          }`}
        >
          {locating ? <Loader2 className="h-3 w-3 animate-spin" /> : <LocateFixed className="h-3 w-3" />}
          Near me
        </button>

        {nearMe && home && (
          <div className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap text-xs text-stone-500">
            <span>within</span>
            <input
              type="range"
              min={0}
              max={RADIUS_STEPS.length - 1}
              step={1}
              value={RADIUS_STEPS.indexOf(radius)}
              onChange={(e) => setRadius(RADIUS_STEPS[Number(e.target.value)])}
              aria-label="Distance in miles"
              className="w-24 accent-indigo-600"
            />
            <b className="font-mono text-stone-800">{radius} mi</b>
          </div>
        )}

        {(topics.length > 0 || freeOnly || nearMe || query || organizer) && (
          <button
            onClick={() => {
              setTopics([]);
              setFreeOnly(false);
              setNearMe(false);
              setOrganizer(null);
              // The search box is the page's now, so Reset asks it to clear
              // rather than clearing a copy and leaving words in the input.
              onClearQuery?.();
            }}
            className="shrink-0 whitespace-nowrap text-xs text-stone-400 underline underline-offset-2 hover:text-stone-700"
          >
            Reset
          </button>
        )}
      </div>

      {geoError && <p className="mt-2 text-xs text-amber-700">{geoError}</p>}

      {/* State of the world, one line. Either we know where you are (and every
          card can say how far), or we don't and there is one tap to fix it. */}
      {home ? (
        <p className="mt-2 inline-flex items-center gap-1 text-xs text-stone-500">
          <MapPin className="h-3 w-3 text-emerald-600" />
          Nearest first, measured from where you are
        </p>
      ) : locationOff ? (
        <button
          onClick={() => void useMyLocation()}
          className="mt-2 inline-flex items-center gap-1 text-xs text-indigo-600 underline underline-offset-2 hover:text-indigo-800"
        >
          <LocateFixed className="h-3 w-3" />
          Turn on location to sort by distance
        </button>
      ) : null}

      {/* ── what we heard ─────────────────────────────────────────────── */}
      {result && (query || topics.length > 0 || organizer) && (
        <div className="mt-4 rounded-xl border border-stone-200 bg-stone-50 px-4 py-3">
          <p className="text-[15px] font-medium text-stone-900">{result.summary}</p>
          {result.parseFailed && (
            <p className="mt-1 text-xs text-amber-700">
              Couldn&apos;t read that closely — matching on your words instead.
            </p>
          )}
          {organizer && (
            <button
              onClick={() => {
                setOrganizer(null);
              }}
              className="mt-1 inline-flex items-center gap-1 text-xs text-indigo-600 underline underline-offset-2 hover:text-indigo-800"
            >
              <X className="h-3 w-3" />
              Show everyone again
            </button>
          )}
          <p className="mt-1 text-xs text-stone-500">
            {result.total} of everything upcoming
            {ruledOut.length > 0 && (
              <> · ruled out {ruledOut.map(([r, n]) => `${n} ${r}`).join(", ")}</>
            )}
          </p>
        </div>
      )}

      {/* ── the feed ──────────────────────────────────────────────────── */}
      {error && (
        <p className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error.message}
        </p>
      )}

      {!error && !loading && result?.events.length === 0 && (
        <div className="mt-10 text-center text-stone-500">
          <p className="text-sm">Nothing matched that.</p>
          <p className="mt-1 text-xs">Try widening the distance, or removing a filter.</p>
        </div>
      )}

      <div className={loading ? "opacity-50 transition-opacity" : "transition-opacity"}>
        {grouped.map(([day, evs]) => (
          <section key={day} className="mt-6">
            {/* The day sticks to the top while its own events are on screen.
                Scrolling a long day used to mean losing which day you were in
                and having to scroll back up to find the heading again.
                `sticky` inside the section (not the page) is what makes each
                heading hand over to the next instead of stacking.

                Offset = the app header (3.5rem) + the sticky tab row beneath it
                (56px, measured), so it parks directly under them rather than
                sliding behind. Full-bleed background, or cards would show
                through the gap as they pass under it. */}
            <h2
              className="sticky z-10 -mx-4 mb-2 bg-stone-50/90 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-stone-400 backdrop-blur md:-mx-8 md:px-8"
              style={{ top: "calc(7rem + env(safe-area-inset-top))" }}
            >
              {dayLabel(day)}
            </h2>
            <ul className="space-y-2">
              {evs.map((e) => (
                // The whole card opens the event, but the organiser inside it is
                // its own control — and a <button> may not live inside an <a>.
                // So the link is a stretched overlay and the organiser tag is a
                // later positioned sibling, which paints above it.
                <li
                  key={e.id}
                  className="group relative rounded-xl border border-stone-200 bg-white p-3 transition hover:border-stone-300 hover:shadow-sm"
                >
                  <Link
                    href={`/events/${e.id}`}
                    aria-label={`Open ${e.title}`}
                    className="absolute inset-0 z-0 rounded-xl"
                  />
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-[15px] font-semibold text-stone-900">
                          {e.title}
                        </h3>
                        <p className="mt-0.5 truncate text-xs text-stone-500">
                          {[e.time, e.venue].filter(Boolean).join(" · ") || e.source}
                        </p>
                      </div>
                      {/* When and where — the two facts that decide whether
                          something is even possible, so they sit together at
                          the top right with colour, not in the grey reason
                          pills below. */}
                      <div className="flex shrink-0 items-center gap-1">
                        {(() => {
                          const w = whenBadge(e, agedMin);
                          if (!w) return null;
                          const tone =
                            w.tone === "now"
                              ? "bg-rose-50 text-rose-700"
                              : w.tone === "soon"
                                ? "bg-amber-50 text-amber-800"
                                : w.tone === "past"
                                  ? "bg-stone-100 text-stone-400 line-through decoration-stone-300"
                                  : "bg-stone-100 text-stone-600";
                          return (
                            <span
                              className={`inline-flex items-center gap-0.5 whitespace-nowrap rounded-full px-2 py-0.5 font-mono text-[11px] font-semibold ${tone}`}
                            >
                              <Clock className="h-3 w-3" />
                              {w.label}
                            </span>
                          );
                        })()}

                        {e.miles != null ? (
                          <span className="whitespace-nowrap rounded-full bg-emerald-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-emerald-800">
                            <MapPin className="mr-0.5 inline h-3 w-3" />
                            {e.miles < 0.2 ? "here" : `${e.miles} mi`}
                          </span>
                        ) : home ? (
                          // We know where the reader is but not where this is.
                          // Saying nothing would imply it is nearby.
                          <span className="whitespace-nowrap rounded-full bg-stone-100 px-2 py-0.5 text-[11px] text-stone-400">
                            no pin
                          </span>
                        ) : null}
                      </div>
                    </div>

                    {e.why.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {e.why.map((w, i) => (
                          <span
                            key={i}
                            className={`rounded-full border px-2 py-0.5 text-[11px] ${
                              i === 0
                                ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                                : "border-stone-200 text-stone-500"
                            }`}
                          >
                            {w}
                          </span>
                        ))}
                      </div>
                    )}

                  </div>

                  {/* The organiser, as a real control. It used to be the
                      faintest text on the card despite being the thing a reader
                      most often wants more of — tapping it shows everything
                      that organiser has on. `relative` lifts it above the
                      stretched link covering the card. */}
                  <button
                    type="button"
                    onClick={() => {
                      const next = organizer === e.source ? null : e.source;
                      setOrganizer(next);
                    }}
                    className={`relative z-10 mt-2 inline-flex max-w-full items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                      organizer === e.source
                        ? "border-indigo-600 bg-indigo-600 text-white"
                        : "border-stone-200 bg-stone-50 text-stone-600 hover:border-indigo-400 hover:bg-white hover:text-indigo-700"
                    }`}
                  >
                    <Building2 className="h-3 w-3 shrink-0" />
                    <span className="truncate">{e.source}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}

        {/* Everything ranked below the fold used to be simply unreachable: a
            broad filter matched far more than one screen and the list just
            stopped. Revealing is local — no request, no model call. */}
        {more > 0 && (
          <div className="mt-8 flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={showMore}
              className="rounded-full border border-stone-300 bg-white px-5 py-2 text-sm font-semibold text-stone-700 transition hover:border-stone-400 hover:bg-stone-50"
            >
              Show {Math.min(more, PAGE)} more
            </button>
            <p className="text-xs text-stone-400">
              {visible.length} of {result?.total ?? all.length}
            </p>
          </div>
        )}

        {/* Ranked past what one response carries. Saying so beats a list that
            quietly ends — the useful move here is a narrower query, not more
            scrolling. */}
        {more === 0 && (result?.total ?? 0) > all.length && (
          <p className="mt-8 text-center text-xs text-stone-400">
            Showing the top {all.length} of {result?.total}. Add a filter to narrow it down.
          </p>
        )}
      </div>

      {loading && !result && (
        <div className="mt-10 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-stone-400" />
        </div>
      )}
    </div>
  );
}
