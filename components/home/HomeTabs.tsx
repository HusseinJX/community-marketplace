"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Newspaper, CalendarDays, Store, ArrowRight, Trophy, MapPin } from "lucide-react";
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
export function HomeTabs() {
  const [tab, setTab] = useState<Tab>("feed");

  // Hydrate the initial tab from the URL (?tab=), then keep the URL in sync
  // without a full navigation so the browser back button steps through tabs.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("tab");
    if (isTab(q)) setTab(q);
  }, []);

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
      {/* Small hero — one-line "what this is" so first-time visitors get oriented. */}
      <div className="mx-auto max-w-6xl px-4 pt-4 md:px-8">
        <div className="rounded-2xl bg-gradient-to-br from-purple-700 to-pink-600 px-5 py-4 text-white sm:px-6 sm:py-5">
          <h1 className="text-lg font-semibold tracking-tight sm:text-xl">
            Your neighborhood, all in one place.
          </h1>
          <p className="mt-1 max-w-2xl text-sm leading-snug text-white/85 sm:text-[0.95rem]">
            Discover local stories, real-world events, and the businesses, makers &amp; community
            orgs near you — and see who&apos;s giving back to the neighborhood.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Link
              href="/world-cup"
              className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-xs font-semibold text-purple-700 transition hover:bg-white/90"
            >
              <Trophy className="h-3.5 w-3.5" />
              World Cup 2026
            </Link>
            <Link
              href="/sf"
              className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3.5 py-1.5 text-xs font-semibold transition hover:bg-white/25"
            >
              <MapPin className="h-3.5 w-3.5" />
              SF
            </Link>
            <Link
              href="/about"
              className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3.5 py-1.5 text-xs font-semibold transition hover:bg-white/25"
            >
              What&apos;s this about?
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 pt-4 md:px-8">
        <HomeSearch />
      </div>

      {/* Sticky selector — sits directly beneath the app header. */}
      <div
        className="sticky z-20 border-b border-stone-100 bg-stone-50/85 backdrop-blur"
        style={{ top: "calc(3.5rem + env(safe-area-inset-top))" }}
      >
        <div className="mx-auto flex max-w-6xl justify-center px-4 py-2.5 md:px-8">
          <div className="inline-flex rounded-full bg-stone-100 p-1">
            {TABS.map(({ id, label, icon: Icon }) => {
              const active = tab === id;
              return (
                <button
                  key={id}
                  onClick={() => pick(id)}
                  aria-pressed={active}
                  className={
                    "inline-flex items-center gap-1.5 rounded-full px-5 py-2 text-sm font-semibold transition " +
                    (active
                      ? "bg-white text-stone-900 shadow-sm"
                      : "text-stone-500 hover:text-stone-800")
                  }
                >
                  <Icon className="h-4 w-4" />
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
          <section className="mx-auto max-w-6xl border-t border-stone-100 px-4 pb-24 pt-8 md:px-8">
            <Link
              href="/events"
              className="group mb-5 inline-flex items-center gap-1 text-xl font-semibold tracking-tight text-stone-900 transition hover:text-stone-600"
            >
              From the community
              <ChevronRight className="h-5 w-5 text-stone-400 transition group-hover:translate-x-0.5 group-hover:text-stone-600" />
            </Link>
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
