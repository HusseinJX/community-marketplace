"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Newspaper,
  CalendarDays,
  CalendarRange,
  Store,
  ArrowRight,
  ShoppingBag,
  Sparkles,
  Map as MapIcon,
  CalendarPlus,
} from "lucide-react";
import { Marketplace } from "@/components/shop/Marketplace";
import { EventSearchBar } from "@/components/feed/EventSearchBar";
import { CityHeader } from "@/components/home/CityHeader";
import { LiveNowRail } from "@/components/live/LiveNowRail";
import { CommunityEventsLive } from "@/components/live/CommunityEventsLive";
import { EventsMapView } from "@/components/live/EventsMapView";
import { PersonalizedEvents } from "@/components/feed/PersonalizedEvents";
import { LocalDirectory } from "@/components/home/LocalDirectory";
import { HomeSearch } from "@/components/home/HomeSearch";
import { CommunityFeed } from "@/components/feed/CommunityFeed";
import { HOME_TABS, DEFAULT_HOME_TAB, toHomeTab, rememberHomeTab, type HomeTab } from "@/lib/home-tab";
import { SupportCard } from "@/components/support/SupportCard";
import { useIsMdUp } from "@/lib/use-media-query";
import {
  useHomeHeader,
  setHeaderActive,
  setHeaderCollapsed,
  setHeaderLabel,
  releaseHeaderPin,
} from "@/lib/home-header";

// Labels + ids live in lib/home-tab.ts so detail-page back links can name the
// tab without importing this component. Icons stay here — they're presentation.
const TAB_ICONS: Record<HomeTab, typeof Newspaper> = {
  events: CalendarDays,
  feed: Newspaper,
  shop: Store,
  products: ShoppingBag,
};

// Publishes a folding band's own content height as --hdr-h on the wrapper, so
// the fold can interpolate a real px height without anyone guessing a number
// and without the browser having to interpolate grid tracks (which older
// Safari simply refuses to do — it snaps).
function useFoldHeight() {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    const inner = el?.firstElementChild as HTMLElement | null;
    if (!el || !inner) return;
    let known = 0;
    let retry: ReturnType<typeof setInterval> | null = null;
    const measure = () => {
      const h = inner.offsetHeight;
      if (!h || Math.abs(h - known) < 1) return;
      // A new measurement is only allowed to land while the band is OPEN.
      // On a fresh load the height is still settling — the webfont swaps, the
      // search hydrates — and each correction arriving mid-fold rewrote the
      // height the fold was interpolating toward, which the eye reads as the
      // nav twitching. Open, the same correction is invisible: the band is
      // already showing its full content height.
      const p = Number(
        getComputedStyle(document.documentElement).getPropertyValue("--hdr-p") || 0,
      );
      if (known && p > 0.001) {
        // Deferred, not dropped: the observer will not fire again once the
        // size has stopped changing, so a correction that arrives mid-fold
        // has to come back on its own or the band keeps a stale height for as
        // long as the reader stays scrolled.
        if (!retry) retry = setInterval(measure, 250);
        return;
      }
      if (retry) {
        clearInterval(retry);
        retry = null;
      }
      known = h;
      el.style.setProperty("--hdr-h", `${h}px`);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(inner);
    return () => {
      ro.disconnect();
      if (retry) clearInterval(retry);
    };
  }, []);
  return ref;
}

// Airbnb-style segmented home: a sticky selector under the top nav switches
// between Feed (live venues + community posts), Events (now + upcoming), and
// Shop (the local directory). Tab is mirrored to ?tab= so back/deep-links work.
export function HomeTabs() {
  const [tab, setTab] = useState<HomeTab>(DEFAULT_HOME_TAB);
  // Which way the Events tab is being read. A toggle, not a tab: same events.
  //
  // The ids name the ICON, not the component behind it:
  //   "browse" = the calendar icon  → the dated list (PersonalizedEvents)
  //   "foryou" = the spark icon     → the themed category rails (CommunityEventsLive)
  //   "map"    = the map icon       → the same events as pins
  // Defaults to the calendar — a plain dated list is what someone who has said
  // nothing should land on.
  const [eventsView, setEventsView] = useState<"foryou" | "browse" | "map">("browse");

  // The event search box lives up here, in the page's top search slot, so the
  // Events tab has ONE input rather than a business search stacked above an
  // event search. `text` is what is typed; `query` is what was submitted —
  // typing must never re-key the feed, since each miss costs a model call.
  const [eventText, setEventText] = useState("");
  const [eventQuery, setEventQuery] = useState("");
  const [eventsLoading, setEventsLoading] = useState(false);

  // Shops and Products search in place: both tabs already hold their whole
  // catalogue client-side, so the header box filters what is on screen as you
  // type rather than navigating to /explore and back. One keyword per
  // catalogue — they list different things, so a word typed against products
  // shouldn't silently narrow the shops you come back to.
  const [shopQuery, setShopQuery] = useState("");
  const [productQuery, setProductQuery] = useState("");


  // ── Collapsing header ──────────────────────────────────────────────────
  // Scrolled past the first screenful, the city row / tab switcher / search
  // fold away and the search reappears as a compact pill in the wordmark row
  // (rendered by TopNav — see lib/home-header for why the state is shared
  // through a module store rather than props).
  //
  // The threshold is deliberately past the header's own height: collapsing the
  // instant someone nudges the page makes the whole thing twitch on a
  // trackpad.
  const searchFoldRef = useFoldHeight();
  const tabsFoldRef = useFoldHeight();

  const store = useHomeHeader();
  const { collapsed, pinned } = store;

  useEffect(() => {
    setHeaderActive(true);
    return () => setHeaderActive(false);
  }, []);

  // The scroll driver lives in an effect; the pin needs to reach into it.
  const drive = useRef<((p: number, hold: boolean) => void) | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    const reduce =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Where the fold happens. A RANGE, not a threshold — the header is a
    // continuous function of the scroll position across these pixels, which
    // is what makes it read as gradual rather than as something that
    // triggered. Smoothstepped so it eases out of both ends instead of
    // starting and stopping at full speed.
    const START = 8;
    const END = 148;
    const curve = (y: number) => {
      const t = Math.min(1, Math.max(0, (y - START) / (END - START)));
      return t * t * (3 - 2 * t);
    };

    // ── The magnet ─────────────────────────────────────────────────────────
    // Two numbers, and the whole feel comes out of the gap between them.
    // `target` is where the header wants to be, `cur` is where it is, and
    // every frame closes a fixed FRACTION of what is left — an exponential
    // approach, so it always eases in and never has an end to overshoot.
    //
    // While the finger is moving, target IS the scroll position and cur is
    // two or three frames behind it: too little to read as lag, enough to
    // absorb trackpad noise and the coarse steps of a mouse wheel.
    //
    // The magnetism is one line on top of that: half-folded is the one state
    // the header should never be left resting in, so when the scrolling stops
    // mid-fold, target snaps to the nearer end and cur glides after it. And
    // because the same mechanism carries the tap-to-expand, the header has
    // exactly ONE way of moving — there is no second animation to fall out of
    // step with the first.
    let target = 0;
    let cur = 0;
    let magnet: number | null = null;
    let idle: ReturnType<typeof setTimeout> | null = null;
    let painted = -1;

    // How much of the remaining gap to close per frame. Higher = more
    // attached to the finger, lower = more floaty. 0.3 lands ~5 frames.
    const CATCH = 0.3;
    // How long the scroll has to stay still before the magnet takes over.
    // Long enough not to fight a pause mid-gesture, short enough that letting
    // go and having it settle reads as one movement.
    const SETTLE = 120;

    // The React half of this, and it is deliberately NOT in step with the
    // property below.
    //
    // `collapsed` is now used for nothing visual — only focus order and
    // aria-hidden — but flipping it emits to the store, which re-renders the
    // whole of HomeTabs: the events feed, the marketplace, the directory.
    // Fired the moment p crossed 0.5 that landed one very long frame in the
    // exact middle of the fold, every time, which was the jerk. Nothing about
    // the movement needs it, so it waits: committed at the ends, where
    // nothing is moving, or once the scroll has settled.
    let want = false;
    const syncState = (p: number) => {
      const next = p > 0.5;
      if (next === want) return;
      // ONLY at the ends. The previous version scheduled the commit 140ms
      // after the crossing, which is fine at a flick and wrong at a crawl:
      // scroll slowly and 140ms later you are still mid-fold, so the render
      // landed in the middle of the movement — exactly the frame it was
      // written to avoid. There is no timer now because there doesn't need to
      // be one: the magnet guarantees every resting state is 0 or 1, so
      // waiting for an end is waiting for a moment that always comes, and
      // nothing is moving when it does.
      if (p > 0.001 && p < 0.999) return;
      want = next;
      setHeaderCollapsed(next);
    };

    const paint = (v: number) => {
      // Below a frame's worth of visible change, skip the style write
      // entirely rather than making the browser recalculate for nothing.
      if (Math.abs(v - painted) < 0.002 && v > 0 && v < 1) return;
      painted = v;
      // A custom property on <html>, not React state: this runs on every
      // frame of every scroll, and a re-render per frame is precisely the
      // jank we are removing.
      root.style.setProperty("--hdr-p", v.toFixed(3));
      syncState(v);
    };

    // Aim at a value. `hold` is the magnet: keep aiming here even as the
    // scroll position says otherwise, until it says otherwise CONVINCINGLY.
    const aim = (p: number, hold: boolean) => {
      magnet = hold ? p : null;
      target = p;
      kick();
    };
    drive.current = aim;

    const scrolled = (p: number) => {
      // A magnet is broken by the scroll crossing the halfway line, not by
      // any movement at all — otherwise the snap it just made would be undone
      // by the same gesture that caused it.
      if (magnet !== null && (magnet === 1 ? p < 0.5 : p > 0.5)) magnet = null;
      target = magnet ?? p;

      if (idle) clearTimeout(idle);
      // Left mid-fold with the finger gone: pick a side. Only mid-fold —
      // already open or already shut is not something to snap out of.
      if (magnet === null && p > 0.02 && p < 0.98) {
        idle = setTimeout(() => {
          idle = null;
          aim(p > 0.5 ? 1 : 0, true);
        }, SETTLE);
      }
    };

    // ── One loop ───────────────────────────────────────────────────────────
    // There were two: a rAF that read the scroll position, and a second rAF
    // that eased `cur` toward `target`. Both could be pending in the same
    // frame, in either order, so a scroll sample sometimes landed just after
    // that frame's ease had already run and waited a whole frame to be used —
    // which is a one-frame stutter appearing and disappearing depending on
    // event timing. That IS jitter, and no amount of curve tuning reaches it.
    //
    // One loop: sample, ease, paint, in that order, once per frame, and stop
    // the moment there is nothing left to do.
    let running = 0;
    let pending = false;
    let moving = false;

    const kick = () => {
      if (!running) running = window.requestAnimationFrame(loop);
    };

    function loop() {
      running = 0;
      const sampled = pending;
      pending = false;
      if (sampled && !store.pinned) scrolled(curve(window.scrollY));

      const gap = target - cur;
      if (reduce || Math.abs(gap) < 0.0015) cur = target;
      else cur += gap * CATCH;
      paint(cur);

      // While the fold is mid-travel, the browser must not "helpfully" keep
      // the content below where it was. Scroll anchoring compensates for a
      // size change ABOVE the anchor by moving the scroll position — which
      // changes the scroll position the fold is computed from, which changes
      // the size, which triggers another compensation. A feedback loop, and
      // it reads as the header shivering. Suppressed only WHILE folding:
      // at rest anchoring goes back to doing its job of keeping the feed
      // still when an image loads above the viewport.
      const inFlight = cur > 0.001 && cur < 0.999;
      if (inFlight !== moving) {
        moving = inFlight;
        root.classList.toggle("wl-hdr-moving", inFlight);
      }

      if (pending || cur !== target) kick();
    }

    const onScroll = () => {
      // The listener does nothing but mark the frame dirty. Reading scrollY
      // here would be a layout read inside an event that fires far faster
      // than the compositor can use.
      pending = true;
      kick();
    };
    // Arriving already scrolled (a back navigation, a restored position) must
    // not start open and then fall shut — no ride, just the state.
    cur = target = curve(window.scrollY);
    paint(cur);

    // A pin is released by a GESTURE, never by a scroll event — `scroll` is
    // also emitted by layout changes the reader did not ask for.
    const onGesture = () => releaseHeaderPin();

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("wheel", onGesture, { passive: true });
    window.addEventListener("touchmove", onGesture, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("wheel", onGesture);
      window.removeEventListener("touchmove", onGesture);
      if (running) window.cancelAnimationFrame(running);
      if (idle) clearTimeout(idle);
      root.classList.remove("wl-hdr-moving");
      drive.current = null;
      // Leaving home, the property has to go with it — TopNav is rendered by
      // the root layout and would otherwise stay folded on the next page.
      root.style.removeProperty("--hdr-p");
    };
  }, [store]);

  // Tapping the compact pill is the one move with no gesture behind it, so it
  // is a magnet rather than a track: aim at open and HOLD there, against a
  // scroll position that still says collapsed. The hold is what keeps it
  // open; the release is the reader's next scroll, and from there the same
  // glide carries it back.
  useEffect(() => {
    if (pinned) drive.current?.(0, true);
  }, [pinned]);

  // A pin beats the scroll position — that is the whole point of tapping the
  // compact pill while halfway down a list.
  const folded = collapsed && !pinned;
  // The tab switch only folds where something else can reach it. See section C.
  const isMdUp = useIsMdUp();
  const foldTabs = folded && isMdUp;

  // What the compact pill says: whatever was actually searched, so the
  // collapsed state still tells you what you're looking at.
  useEffect(() => {
    setHeaderLabel(
      tab === "events" ? eventQuery : tab === "shop" ? shopQuery : tab === "products" ? productQuery : "",
    );
  }, [tab, eventQuery, shopQuery, productQuery]);

  const runEventSearch = () => {
    setEventQuery(eventText);
    // A search is answered by the ranked list, which is the CALENDAR side now.
    // Being left on the themed rails — which don't read the query at all —
    // would look exactly like the search having done nothing.
    setEventsView("browse");
  };

  const clearEventSearch = () => {
    setEventText("");
    setEventQuery("");
  };

  // Hydrate the initial tab from the URL (?tab=), then keep the URL in sync
  // without a full navigation so the browser back button steps through tabs.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("tab");
    const initial = toHomeTab(q) ?? DEFAULT_HOME_TAB;
    setTab(initial);
    // ?tab=whatson / ?tab=foryou still name a VIEW, even though neither is a
    // tab any more — both land on Events, pointed at the right side of it.
    if (q === "whatson") setEventsView("browse");
    if (q === "foryou") setEventsView("foryou");
    // Record it on arrival too, not just on click — someone who lands on
    // /?tab=shop and opens a profile should still get "← Shop".
    rememberHomeTab(initial);
  }, []);

  // The width the page's title column takes. On Events it follows the VIEW —
  // the dated list is a 2xl column, the rails and the map are 6xl — and the
  // city line uses the same value, so "San Francisco" and "Events near you"
  // start on the same left edge instead of the city sitting out at the 6xl
  // margin while the heading was indented to 2xl.
  // One width for the whole Events tab now that the dated list is a two-column
  // grid on desktop rather than a single narrow ribbon. Switching views no
  // longer changes how wide the page is.
  const titleWidth = "max-w-6xl";

  const pick = (next: HomeTab) => {
    setTab(next);
    rememberHomeTab(next);
    const url = new URL(window.location.href);
    // "/" is the Events tab, so that is the one with no query param.
    if (next === DEFAULT_HOME_TAB) url.searchParams.delete("tab");
    else url.searchParams.set("tab", next);
    window.history.replaceState(null, "", url.toString());
    window.scrollTo({ top: 0 });
  };

  // The one line for supply: this is a shopper door, but the wedge is
  // businesses teaming up, and a cold visitor who owns a bakery would otherwise
  // have to dig it out of the footer. On Events it asks for the thing that tab
  // is made of — the supply gap there is events, not listings — but both land
  // on the same /join.
  //
  // Every tab renders it directly under that tab's heading, never inside the
  // feed component below it. It is an ask, so it belongs to the section rather
  // than to whatever is currently filtered — and one placement means it cannot
  // drift between the two Events views.
  const supplyLink = (
    <Link
      href="/join"
      className="flex items-center gap-2 text-[13px] text-stone-500 transition hover:text-stone-900"
    >
      {tab === "events" ? (
        <>
          <CalendarPlus className="h-3.5 w-3.5 shrink-0 text-stone-400" />
          <span className="min-w-0 truncate">
            <span className="font-medium text-stone-700">Hosting something?</span> Add an event
          </span>
        </>
      ) : (
        <>
          <Store className="h-3.5 w-3.5 shrink-0 text-stone-400" />
          <span className="min-w-0 truncate">
            <span className="font-medium text-stone-700">Own a local business?</span> Add your profile!
          </span>
        </>
      )}
      <ArrowRight className="h-3.5 w-3.5 shrink-0" />
    </Link>
  );

  return (
    <>
      {/* Parked for App Store resubmission (Apple 5.2.1 — the "World Cup 2026"
          CTA is trademarked FIFA content). Kept here to restore once the World
          Cup feature is re-enabled (see lib/features.ts `worldCup`).

      <div className="mx-auto max-w-6xl px-4 pt-4 md:px-8">
        <div className="relative rounded-2xl bg-gradient-to-br from-purple-700 to-pink-600 px-4 py-4 text-white sm:px-5">
          <h1 className="text-xl font-semibold tracking-tight">
            Your neighborhood, all in one place.
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-snug text-white/85">
            Discover your local ecosystem, engage in it, and see who's giving back to the
            neighborhood.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Link href="/world-cup" ...>World Cup 2026</Link>
            <Link href="/sf" ...>SF</Link>
            <Link href="/about" ...>What's this about?</Link>
          </div>
        </div>
      </div>
      */}

      {/* ── The header band ────────────────────────────────────────────────
          One block under the app's top nav:

            1. WHERE you are      (the city — desktop; on a phone it rides in
                                   the title row instead, see TopNav)
            2. WHAT you want      (the search)
            3. WHICH catalogue    (Events · Shops · Products)

          The whole thing folds away on scroll and the search reappears as a
          compact pill in the title row.

          Everything that folds, in one wrapper.
          A grid-rows 1fr→0fr transition rather than max-height: max-height has
          to be guessed, and a guess that is too small clips the row while it
          animates while one that is too large makes the collapse look like it
          stalls before it starts. 0fr collapses to exactly the content's
          height, whatever that turns out to be. */}
      <div
        className="wl-hdr-band sticky z-20 border-b border-stone-200"
        style={{
          // Segment two of the shared header ramp — starts on the exact colour
          // AppHeader ends on. See --hdr-* in globals.css.
          background: "linear-gradient(to bottom, var(--hdr-2), var(--hdr-3))",
          // Sticky, and pinned directly under the nav. This is what makes
          // "tap the compact pill to expand" work at all: the block is in
          // normal flow at the top of the document, so re-expanding it while
          // scrolled 700px down would open it far above the viewport and the
          // tap would look like it did nothing. Stuck under the header, it
          // opens where the reader is actually looking.
          top: "calc(var(--top-nav) + env(safe-area-inset-top))",
          // The browser must not "helpfully" re-scroll to keep the content
          // below in place when this opens and closes — that compensation is
          // what fought the expand (see the scroll handler above), and it also
          // makes the list jump under the reader's eyes mid-animation.
          overflowAnchor: "none",
        }}
      >
        {/* Section A — city + search. Folds at EVERY width: the search has a
            second home in the title row, so it loses nothing by collapsing. */}
        {/* Height and opacity both come off --hdr-p — see .wl-fold in
            globals.css. Nothing about this band is in React state. */}
        <div className="wl-fold" ref={searchFoldRef} aria-hidden={folded}>
        <div>
      {/* 2 — the search.
          One search box per tab, never two: on Events this slot IS the event
          search, and stacking a business search above it would put two inputs
          on screen competing for the same intent.

          More room UNDER it than over it, so the rule reads as the floor of
          the whole header rather than as a line crowding the input.

          The gradient: stone-50 at the top of the nav easing to stone-100 at
          this edge, so the header has a floor even before you reach the rule.
          Kept very shallow — a header that announces itself is a header you
          notice instead of the listings. */}
          {/* No background of its own — the ramp on the wrapper above shows
              through, which is the whole point of defining it once.

              The rule spans the full width; the CONTENT inside it uses the
              page container. Padding on the outer box and centring on the
              inner one would inset the search 32px past the cards below it —
              the container has to own both the max width and the padding, or
              nothing lines up. */}
          <div className="pt-3">
            <div className="mx-auto max-w-6xl px-4 md:px-8">
              {tab === "events" ? (
                <EventSearchBar
                  text={eventText}
                  onTextChange={setEventText}
                  onSubmit={runEventSearch}
                  onClear={clearEventSearch}
                  loading={eventsLoading}
                />
              ) : tab === "products" ? (
                <HomeSearch
                  bare
                  value={productQuery}
                  onValueChange={setProductQuery}
                  placeholder="Search products"
                />
              ) : tab === "shop" ? (
                <HomeSearch
                  bare
                  value={shopQuery}
                  onValueChange={setShopQuery}
                  placeholder="Search local businesses"
                />
              ) : (
                // Feed — nothing on the page to filter, so the box still
                // navigates to the directory that can answer it.
                <HomeSearch bare />
              )}
            </div>
          </div>
        </div>
        </div>

        {/* Section C — the product switch, UNDER the search.
            Reads as "search, and here is what you are searching" rather than
            as a setting you have to notice before you type.

            Folds on DESKTOP ONLY. On a phone it stays put: the desktop header
            is four rows deep and the switch is the row you can most afford to
            lose on scroll, but on a phone it is the only visible way to move
            between Events, Shops and Products — the compact pill replaces the
            search, and nothing replaces this. Collapsing it there would leave
            a reader who has scrolled with no route out of the tab they are in
            short of scrolling all the way back. */}
        <div className="wl-fold-md" ref={tabsFoldRef} aria-hidden={foldTabs}>
          <div>
            {/* Collapsed on a phone, this row IS the header's second line, so it
              takes its spacing from the nav rather than from the search that
              is no longer there: nothing above it (the nav's own 22px bottom
              padding is the gap) and 22px below, which is the same 22px the
              search pill has above it against the top of the screen. Even
              margins, top to bottom.

              Expanded, it needs its own gap under the search. */}
          {/* Four pills no longer fit across a 375px phone, so the row scrolls
              instead of wrapping or squeezing: `justify-center` centres it while
              it fits and gives way to the scroll when it doesn't (a plain
              centred flex row would clip both ends instead). The scrollbar is
              hidden — same treatment as every other pill row in the app. */}
          <div
            className="wl-tabrow flex justify-center overflow-x-auto px-4 md:px-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            // 18 rather than 22 below. The toggle group is a rounded grey
            // container with a 4px inset, so the eye reads the row as ending at
            // the white active pill, not at the container edge — which made an
            // equal 22/22 look bottom-heavy. Measuring from what you actually
            // see, 18px here matches the 24px above.
            // paddingTop is the .wl-tabrow rule: on a phone this row survives
            // the fold, so it closes its own top gap in step with it. Fixed
            // here so the measured content height above stays constant.
            style={{ paddingBottom: 18 }}
          >
              <div className="inline-flex shrink-0 rounded-full bg-stone-100 p-1">
                {HOME_TABS.map(({ id, label }) => {
                  const Icon = TAB_ICONS[id];
                  const on = tab === id;
                  return (
                    <button
                      key={id}
                      onClick={() => pick(id)}
                      aria-pressed={on}
                      className={
                        // Label small, icon full size: the glyph is what you
                        // aim at, the word only confirms it.
                        // Tighter horizontal padding under sm — with four tabs
                        // that is the difference between the row fitting a
                        // phone and having to be scrolled on every visit.
                        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 t-meta transition sm:gap-2 sm:px-4 " +
                        (on
                          ? "bg-white font-semibold text-stone-900 shadow-[var(--shadow-soft)]"
                          : "text-stone-500 hover:text-stone-800")
                      }
                    >
                      <Icon className="h-[22px] w-[22px]" strokeWidth={on ? 2.2 : 1.9} />
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>


      {/* Which city you're being served — the same on every tab, so it sits
          outside them rather than being repeated three times. Its own line:
          sharing one with "Events near you" put two titles of different weight
          on a row that already ends in three toggles. */}
      <div className={`mx-auto px-4 pt-3 md:px-8 ${titleWidth}`}>
        <CityHeader />
      </div>

      {/* One card, above the body, OUTSIDE the tab switch — so it is on every
          tab without being written three times and without re-mounting (and
          re-polling) each time you switch. Renders nothing at all when signed
          out. */}
      <div className={`mx-auto px-4 pt-3 md:px-8 ${titleWidth}`}>
        <SupportCard />
      </div>

      {/* Body — only the active tab mounts, keeping the page light per view. */}
      {tab === "feed" && (
        <>
          {/* "Live now" is NOT on this tab. It still lives on Events (the
              compact LiveNowRail) and on /live in full — the feed tab is what
              the community posted, and a venue-broadcast section above it
              pushed the actual posts below the fold to say "nothing is live"
              most of the time. */}
          {/* No top rule. It landed directly under the city name — the first
              thing below the page title was a divider, which reads as the end
              of something rather than the start of the feed. */}
          <section className="mx-auto max-w-6xl px-4 pb-24 pt-4 md:px-8">
            <h2 className="text-xl font-semibold tracking-tight text-stone-900">
              From the community
            </h2>
            {/* The "add your business" ask sits under the heading it belongs
                to, not at the top of the tab. Above the feed it was the first
                thing a reader met — a request, before anything worth reading —
                and it pushed the actual content down. Same placement the Shop
                tab already uses (LocalDirectory `belowHeader`). */}
            <div className="mb-5 mt-1">{supplyLink}</div>
            <CommunityFeed layout="feed" />
          </section>
        </>
      )}

      {/* Events reads two ways — ranked around what you asked for, or plain
          chronological. A toggle rather than two tabs: it is the same set of
          events either way, so it belongs next to the heading it modifies, not
          in the row that switches between whole sections of the app. */}
      {tab === "events" && (
        <div className="pb-24 pt-4">
          {/* Same width as the city line above and as the content below —
              see `titleWidth`. Fixed at 2xl the heading sat indented from its
              own content and the toggles floated in the middle of the screen. */}
          <div className={`mx-auto px-4 md:px-8 ${titleWidth}`}>
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <h2 className="truncate text-xl font-semibold tracking-tight text-stone-900">
                Events near you
              </h2>
              {/* Two icons, like the list/grid switch on a desktop feed — the
                  same events, read two ways. It was a labelled pill, which read
                  as a filter you switch ON and left "what's on" unnamed; a
                  segmented pair says there are two views and you are in one. */}
              <div className="inline-flex shrink-0 items-center rounded-full border border-stone-200 bg-white p-0.5">
                {/* Calendar first: the plain chronological list is the default
                    reading of "what's on near me", and the ranked one is the
                    clever version you opt into. */}
                {(
                  [
                    { id: "browse", Icon: CalendarRange, label: "What's on" },
                    { id: "foryou", Icon: Sparkles, label: "For you" },
                    { id: "map", Icon: MapIcon, label: "Map" },
                  ] as const
                ).map(({ id, Icon, label }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setEventsView(id)}
                    aria-pressed={eventsView === id}
                    aria-label={label}
                    title={label}
                    className={
                      "inline-flex h-8 w-9 items-center justify-center rounded-full transition " +
                      (eventsView === id
                        ? "bg-stone-900 text-white"
                        : "text-stone-400 hover:text-stone-800")
                    }
                  >
                    <Icon className="h-4 w-4" />
                  </button>
                ))}
              </div>
            </div>
            {/* Under the heading it belongs to, not under the filters. Below the
                pills it read as a footnote to whatever had just been filtered,
                moved every time the view or the topics changed, and disappeared
                entirely once someone scrolled the pills out of view. Here it is
                in the same place on both views — the same placement Feed and
                Shop (LocalDirectory `belowHeader`) already use. */}
            <div className="mt-1">{supplyLink}</div>
          </div>

          {/* Live now — above all three views, because "happening right now" is
              the most urgent answer to "what's on near me" and it was one tab
              away. Self-hiding when nothing is live. */}
          <div className="mx-auto max-w-6xl px-4 pt-4 md:px-8">
            <LiveNowRail />
          </div>

          {/* Calendar = the dated list · spark = themed rails · map = pins. */}
          {eventsView === "map" ? (
            <div className="mx-auto max-w-6xl px-4 pt-4 md:px-8">
              <EventsMapView />
            </div>
          ) : eventsView === "browse" ? (
            <div className="mx-auto max-w-6xl px-4 pt-4 md:px-8">
              <PersonalizedEvents
                query={eventQuery}
                onClearQuery={clearEventSearch}
                onLoadingChange={setEventsLoading}
              />
            </div>
          ) : (
            // pt-4 like the other two: the gap under "Hosting something?" was
            // a different size on each view.
            <div className="pt-4">
              <CommunityEventsLive hideHeading />
            </div>
          )}
        </div>
      )}

      {/* Shops — the local business directory. The marketplace used to hang off
          this tab's heading as a small icon button; it is its own tab now, so
          there is nothing to link out to from here. */}
      {tab === "shop" && (
        <div className="pb-24">
          {/* No title and no supply pitch here: the tab selector above already
              says Shops and each rail names itself, and the "own a local
              business?" ask was the first thing a shopper met on a tab made of
              photographs. It still lives on Events and Feed, and in the
              footer. */}
          <LocalDirectory showHeading={false} query={shopQuery} />
        </div>
      )}

      {/* Products — the same marketplace as /shop, rendered in place. The tab
          shell already owns the header and the way back, so it goes in
          embedded. */}
      {tab === "products" && <Marketplace embedded query={productQuery} />}

      {/* Chats — the community rooms, gathered in one place. They're still meant
          to be found in the feed; this is the "all of them" view, the same way
          Shop is the directory behind the businesses you meet in the feed.
          Each card self-hides when it's out of range, so with location gating
          on (lib/demo-community-chats LOCATION_GATING) this shows only the rooms
          near you — which is the point. */}
    </>
  );
}
