"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Newspaper, CalendarDays, Store, ArrowRight, ShoppingBag, Rows3, Sparkles } from "lucide-react";
import { LiveFeed } from "@/components/live/LiveFeed";
import { CommunityEventsLive } from "@/components/live/CommunityEventsLive";
import { PersonalizedEvents } from "@/components/feed/PersonalizedEvents";
import { LocalDirectory } from "@/components/home/LocalDirectory";
import { HomeSearch } from "@/components/home/HomeSearch";
import { CommunityFeed } from "@/components/feed/CommunityFeed";
import { HOME_TABS, isHomeTab, rememberHomeTab, type HomeTab } from "@/lib/home-tab";

// Labels + ids live in lib/home-tab.ts so detail-page back links can name the
// tab without importing this component. Icons stay here — they're presentation.
const TAB_ICONS: Record<HomeTab, typeof Newspaper> = {
  events: CalendarDays,
  feed: Newspaper,
  shop: Store,
};

// Airbnb-style segmented home: a sticky selector under the top nav switches
// between Feed (live venues + community posts), Events (now + upcoming), and
// Shop (the local directory). Tab is mirrored to ?tab= so back/deep-links work.
export function HomeTabs() {
  const [tab, setTab] = useState<HomeTab>("events");
  // Sub-view of the Events tab: chronological, or ranked around a sentence.
  const [eventsView, setEventsView] = useState<"browse" | "foryou">("foryou");

  // Hydrate the initial tab from the URL (?tab=), then keep the URL in sync
  // without a full navigation so the browser back button steps through tabs.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("tab");
    const initial = isHomeTab(q) ? q : "events";
    setTab(initial);
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
        <HomeSearch />

        {/* The one line for supply: this is a shopper door, but the wedge is
            businesses teaming up, and a cold visitor who owns a bakery would
            otherwise have to dig it out of the footer. */}
        <Link
          href="/businesses"
          className="mt-3 flex items-center gap-2 text-[13px] text-stone-500 transition hover:text-stone-900"
        >
          <Store className="h-3.5 w-3.5 shrink-0 text-stone-400" />
          <span className="min-w-0 truncate">
            <span className="font-medium text-stone-700">Own a local business?</span> Add your profile!
          </span>
          <ArrowRight className="h-3.5 w-3.5 shrink-0" />
        </Link>
      </div>

      {/* Sticky selector — sits directly beneath the app header. */}
      <div
        className="sticky z-20 mt-4 border-b border-stone-100 bg-stone-50/85 backdrop-blur"
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

      {/* Body — only the active tab mounts, keeping the page light per view. */}
      {tab === "feed" && (
        <>
          <LiveFeed />
          <section className="mx-auto max-w-6xl border-t border-stone-100 px-4 pb-24 pt-4 md:px-8">
            <h2 className="mb-5 text-xl font-semibold tracking-tight text-stone-900">
              From the community
            </h2>
            <CommunityFeed layout="feed" />
          </section>
        </>
      )}

      {/* Events tab reads two ways: chronological (what's on, soonest first) or
          rearranged around a sentence someone types. A sub-toggle rather than a
          fourth top-level tab — it is the same events either way, and the top
          row is already at its limit on a phone. */}
      {tab === "events" && (
        <div className="pb-24 pt-4">
          <div className="mx-auto max-w-6xl px-4 md:px-8">
            <div
              role="tablist"
              aria-label="Events view"
              className="inline-flex rounded-full border border-stone-200 bg-white p-0.5"
            >
              {(
                [
                  { id: "browse", label: "What's on", Icon: Rows3 },
                  { id: "foryou", label: "For you", Icon: Sparkles },
                ] as const
              ).map(({ id, label, Icon }) => (
                <button
                  key={id}
                  role="tab"
                  aria-selected={eventsView === id}
                  onClick={() => setEventsView(id)}
                  className={
                    "inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[13px] font-semibold transition " +
                    (eventsView === id
                      ? "bg-stone-900 text-white"
                      : "text-stone-500 hover:text-stone-800")
                  }
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {eventsView === "foryou" ? (
            <div className="mx-auto max-w-2xl px-4 pt-4 md:px-8">
              <PersonalizedEvents />
            </div>
          ) : (
            <div className="pt-2">
              <CommunityEventsLive />
            </div>
          )}
        </div>
      )}

      {tab === "shop" && (
        <div className="pb-24">
          <div className="mx-auto max-w-6xl px-4 pt-4 md:px-8">
            <Link
              href="/shop"
              className="inline-flex items-center gap-2 rounded-full bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-800"
            >
              <ShoppingBag className="h-4 w-4 shrink-0" />
              Go to the marketplace
              <ArrowRight className="h-4 w-4 shrink-0" />
            </Link>
          </div>
          <LocalDirectory />
        </div>
      )}

      {/* Chats — the community rooms, gathered in one place. They're still meant
          to be found in the feed; this is the "all of them" view, the same way
          Shop is the directory behind the businesses you meet in the feed.
          Each card self-hides when it's out of range, so with location gating
          on (lib/demo-community-chats LOCATION_GATING) this shows only the rooms
          near you — which is the point. */}
    </>
  );
}
