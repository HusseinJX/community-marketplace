"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Newspaper, CalendarDays, Store, ArrowRight, ShoppingBag } from "lucide-react";
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
    window.scrollTo({ top: 0 });
  };

  return (
    <>
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
            <span className="font-medium text-stone-700">Own a local business?</span> See who to team up
            with.
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
          <div className="mx-auto max-w-6xl px-4 pt-4 md:px-8">
            <Link
              href="/shop"
              className="flex items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-stone-900 to-indigo-900 px-5 py-4 text-white transition hover:opacity-95"
            >
              <span className="flex items-center gap-3">
                <ShoppingBag className="h-5 w-5 shrink-0" />
                <span>
                  <span className="block text-sm font-semibold">Go to the marketplace</span>
                  <span className="block text-[13px] text-white/70">Search, compare, favorite & add to cart</span>
                </span>
              </span>
              <ArrowRight className="h-5 w-5 shrink-0" />
            </Link>
          </div>
          <LocalDirectory />
        </div>
      )}
    </>
  );
}
