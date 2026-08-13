"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Newspaper,
  CalendarDays,
  CalendarRange,
  Store,
  ArrowRight,
  ShoppingBag,
  Sparkles,
  CalendarPlus,
} from "lucide-react";
import { Marketplace } from "@/components/shop/Marketplace";
import { EventSearchBar } from "@/components/feed/EventSearchBar";
import { CityHeader } from "@/components/home/CityHeader";
import { LiveFeed } from "@/components/live/LiveFeed";
import { CommunityEventsLive } from "@/components/live/CommunityEventsLive";
import { PersonalizedEvents } from "@/components/feed/PersonalizedEvents";
import { LocalDirectory } from "@/components/home/LocalDirectory";
import { HomeSearch } from "@/components/home/HomeSearch";
import { CommunityFeed } from "@/components/feed/CommunityFeed";
import { HOME_TABS, toHomeTab, rememberHomeTab, type HomeTab } from "@/lib/home-tab";

// Labels + ids live in lib/home-tab.ts so detail-page back links can name the
// tab without importing this component. Icons stay here — they're presentation.
const TAB_ICONS: Record<HomeTab, typeof Newspaper> = {
  events: CalendarDays,
  feed: Newspaper,
  shop: Store,
  products: ShoppingBag,
};

// Airbnb-style segmented home: a sticky selector under the top nav switches
// between Feed (live venues + community posts), Events (now + upcoming), and
// Shop (the local directory). Tab is mirrored to ?tab= so back/deep-links work.
export function HomeTabs() {
  const [tab, setTab] = useState<HomeTab>("events");
  // Which way the Events tab is being read. A toggle, not a tab: same events.
  //
  // The ids name the ICON, not the component behind it:
  //   "browse" = the calendar icon  → the dated list (PersonalizedEvents)
  //   "foryou" = the spark icon     → the themed category rails (CommunityEventsLive)
  // Defaults to the calendar — a plain dated list is what someone who has said
  // nothing should land on.
  const [eventsView, setEventsView] = useState<"foryou" | "browse">("browse");

  // The event search box lives up here, in the page's top search slot, so the
  // Events tab has ONE input rather than a business search stacked above an
  // event search. `text` is what is typed; `query` is what was submitted —
  // typing must never re-key the feed, since each miss costs a model call.
  const [eventText, setEventText] = useState("");
  const [eventQuery, setEventQuery] = useState("");
  const [eventsLoading, setEventsLoading] = useState(false);

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
    const initial = toHomeTab(q) ?? "events";
    setTab(initial);
    // ?tab=whatson / ?tab=foryou still name a VIEW, even though neither is a
    // tab any more — both land on Events, pointed at the right side of it.
    if (q === "whatson") setEventsView("browse");
    if (q === "foryou") setEventsView("foryou");
    // Record it on arrival too, not just on click — someone who lands on
    // /?tab=shop and opens a profile should still get "← Shop".
    rememberHomeTab(initial);
  }, []);

  const pick = (next: HomeTab) => {
    setTab(next);
    rememberHomeTab(next);
    const url = new URL(window.location.href);
    // "/" is the Events tab, so that is the one with no query param.
    if (next === "events") url.searchParams.delete("tab");
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

      <div className="mx-auto max-w-6xl px-4 pt-4 md:px-8">
        {/* One search box per tab, never two. On Events the top slot IS the
            event search — stacking a business search above it would put two
            inputs on screen competing for the same intent. Same wrapper as
            HomeSearch so the two are exactly the same width as you switch. */}
        {tab === "events" ? (
          <div className="mx-auto max-w-6xl px-4 md:px-8">
            <EventSearchBar
              text={eventText}
              onTextChange={setEventText}
              onSubmit={runEventSearch}
              onClear={clearEventSearch}
              loading={eventsLoading}
            />
          </div>
        ) : (
          <HomeSearch />
        )}
      </div>

      {/* Sticky selector — search, then where you are going. It follows the
          search box rather than sitting under a supply pitch, so the first two
          things on the screen are the two ways to move. Still sticky: position
          in the document doesn't change what it does once you scroll past it. */}
      <div
        className="sticky z-20 mt-3 border-b border-stone-100 bg-stone-50/85 backdrop-blur"
        style={{ top: "calc(3.5rem + env(safe-area-inset-top))" }}
      >
        <div className="mx-auto flex max-w-6xl justify-center px-4 py-2 md:px-8">
          <div className="inline-flex rounded-full bg-stone-100 p-1">
            {HOME_TABS.map(({ id, label }) => {
              const Icon = TAB_ICONS[id];
              const active = tab === id;
              return (
                <button
                  key={id}
                  onClick={() => pick(id)}
                  aria-pressed={active}
                  className={
                    "inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[13px] font-semibold transition " +
                    (active
                      ? "bg-white text-stone-900 shadow-sm"
                      : "text-stone-500 hover:text-stone-800")
                  }
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Which city you're being served — the same on every tab, so it sits
          outside them rather than being repeated three times. */}
      <div className="mx-auto max-w-6xl px-4 pt-3 md:px-8">
        <CityHeader />
      </div>

      {/* Body — only the active tab mounts, keeping the page light per view. */}
      {tab === "feed" && (
        <>
          <LiveFeed />
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
          <div className="mx-auto max-w-2xl px-4 md:px-8">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold tracking-tight text-stone-900">
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

          {/* Calendar = the dated list. Spark = the themed category rails. */}
          {eventsView === "browse" ? (
            <div className="mx-auto max-w-2xl px-4 pt-3 md:px-8">
              <PersonalizedEvents
                query={eventQuery}
                onClearQuery={clearEventSearch}
                onLoadingChange={setEventsLoading}
              />
            </div>
          ) : (
            <div className="pt-2">
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
          <LocalDirectory belowHeader={supplyLink} />
        </div>
      )}

      {/* Products — the same marketplace as /shop, rendered in place. The tab
          shell already owns the header and the way back, so it goes in
          embedded. */}
      {tab === "products" && <Marketplace embedded />}

      {/* Chats — the community rooms, gathered in one place. They're still meant
          to be found in the feed; this is the "all of them" view, the same way
          Shop is the directory behind the businesses you meet in the feed.
          Each card self-hides when it's out of range, so with location gating
          on (lib/demo-community-chats LOCATION_GATING) this shows only the rooms
          near you — which is the point. */}
    </>
  );
}
