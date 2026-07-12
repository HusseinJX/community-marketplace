"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Newspaper, CalendarDays, Store, ArrowRight, Trophy, MapPin, X } from "lucide-react";
import { LiveFeed } from "@/components/live/LiveFeed";
import { CommunityEventsLive } from "@/components/live/CommunityEventsLive";
import { LocalDirectory } from "@/components/home/LocalDirectory";
import { HomeSearch } from "@/components/home/HomeSearch";
import { CommunityFeed } from "@/components/feed/CommunityFeed";

type Tab = "feed" | "events" | "shop";

const TABS: { id: Tab; label: string; icon: typeof Newspaper }[] = [
  { id: "feed", label: "Feed", icon: Newspaper },
  { id: "events", label: "Events", icon: CalendarDays },
  { id: "shop", label: "Shop", icon: Store },
];

function isTab(v: string | null): v is Tab {
  return v === "feed" || v === "events" || v === "shop";
}

// Airbnb-style segmented home: a sticky selector under the top nav switches
// between Feed (live venues + community posts), Events (now + upcoming), and
// Shop (the local directory). Tab is mirrored to ?tab= so back/deep-links work.
const HERO_DISMISSED_KEY = "home-hero-dismissed";

export function HomeTabs() {
  const [tab, setTab] = useState<Tab>("feed");
  // The intro hero is dismissible; the choice persists so it stays hidden.
  const [heroDismissed, setHeroDismissed] = useState(false);

  // Hydrate the initial tab from the URL (?tab=), then keep the URL in sync
  // without a full navigation so the browser back button steps through tabs.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("tab");
    if (isTab(q)) setTab(q);
    if (localStorage.getItem(HERO_DISMISSED_KEY) === "1") setHeroDismissed(true);
  }, []);

  const dismissHero = () => {
    setHeroDismissed(true);
    localStorage.setItem(HERO_DISMISSED_KEY, "1");
  };

  const pick = (next: Tab) => {
    setTab(next);
    const url = new URL(window.location.href);
    if (next === "feed") url.searchParams.delete("tab");
    else url.searchParams.set("tab", next);
    window.history.replaceState(null, "", url.toString());
    // Deep-linked event locks (?event=) only make sense on the feed tab.
    window.scrollTo({ top: 0 });
  };

  return (
    <>
      {/* Small hero — one-line "what this is" so first-time visitors get oriented.
          Dismissible; the choice persists in localStorage. */}
      {!heroDismissed && (
      <div className="mx-auto max-w-6xl px-4 pt-4 md:px-8">
        <div className="relative rounded-2xl bg-gradient-to-br from-purple-700 to-pink-600 px-4 py-4 text-white sm:px-5">
          <button
            type="button"
            onClick={dismissHero}
            aria-label="Dismiss"
            className="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/30"
          >
            <X className="h-4 w-4" />
          </button>
          <h1 className="pr-8 text-xl font-semibold tracking-tight">
            See what&apos;s happening near you.
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-snug text-white/85">
            Live venues, pop-ups, and events from local businesses teaming up — tonight and this
            weekend.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Link
              href="/world-cup"
              className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-[13px] font-semibold text-purple-700 transition hover:bg-white/90"
            >
              <Trophy className="h-4 w-4" />
              World Cup 2026
            </Link>
            <Link
              href="/sf"
              className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3.5 py-1.5 text-[13px] font-semibold transition hover:bg-white/25"
            >
              <MapPin className="h-4 w-4" />
              SF
            </Link>
            <Link
              href="/about"
              className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3.5 py-1.5 text-[13px] font-semibold transition hover:bg-white/25"
            >
              What&apos;s this about?
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
      )}

      <div className="mx-auto max-w-6xl px-4 pt-4 md:px-8">
        <HomeSearch />
      </div>

      {/* Sticky selector — sits directly beneath the app header. */}
      <div
        className="sticky z-20 mt-4 border-b border-stone-100 bg-stone-50/85 backdrop-blur"
        style={{ top: "calc(3.5rem + env(safe-area-inset-top))" }}
      >
        <div className="mx-auto flex max-w-6xl justify-center px-4 py-2 md:px-8">
          <div className="inline-flex rounded-full bg-stone-100 p-1">
            {TABS.map(({ id, label, icon: Icon }) => {
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

      {tab === "events" && (
        <div className="pb-24 pt-6">
          <CommunityEventsLive />
        </div>
      )}

      {tab === "shop" && (
        <div className="pb-24">
          <LocalDirectory />
        </div>
      )}
    </>
  );
}
