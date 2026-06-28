"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { DEMO_FEED, type FeedItem } from "@/lib/demo-feed";
import { EventFeedCard } from "@/components/feed/EventFeedCard";
import { VendorPostCard } from "@/components/feed/VendorPostCard";

type Filter = "all" | "event" | "post";

const tabs: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "event", label: "Events" },
  { id: "post", label: "Vendor Posts" },
];

function FeedInner() {
  // ?view=events → an events-only page (no tabs, just events).
  const eventsOnly = useSearchParams().get("view") === "events";
  const [filter, setFilter] = useState<Filter>(eventsOnly ? "event" : "all");
  const [visible, setVisible] = useState(5);

  const effectiveFilter: Filter = eventsOnly ? "event" : filter;

  const filtered: FeedItem[] = useMemo(() => {
    const sorted = [...DEMO_FEED].sort((a, b) => a.postedAtOrder - b.postedAtOrder);
    if (effectiveFilter === "all") return sorted;
    return sorted.filter((i) => i.kind === effectiveFilter);
  }, [effectiveFilter]);

  const shown = filtered.slice(0, visible);
  const hasMore = visible < filtered.length;

  return (
    <main className="mx-auto w-full max-w-[680px] px-4 py-10 sm:px-6">
      <header className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight text-stone-900">
          {eventsOnly ? "Events" : "Community Feed"}
        </h1>
        <p className="mt-1 text-stone-600">
          {eventsOnly
            ? "Upcoming events from local makers, vendors, and organizers."
            : "Events and updates from local makers and vendors."}
        </p>
      </header>

      {!eventsOnly && (
        <div className="mb-6 -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
          {tabs.map((t) => {
            const active = filter === t.id;
            return (
              <button
                key={t.id}
                onClick={() => {
                  setFilter(t.id);
                  setVisible(5);
                }}
                className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition ${
                  active
                    ? "bg-indigo-600 text-white"
                    : "border border-stone-200 bg-white text-stone-700 hover:border-stone-300"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      )}

      <div className="space-y-4">
        {shown.map((item) =>
          item.kind === "event" ? (
            <EventFeedCard key={item.id} item={item} />
          ) : (
            <VendorPostCard key={item.id} item={item} />
          ),
        )}
      </div>

      {hasMore && (
        <div className="mt-6 flex justify-center">
          <button
            onClick={() => setVisible((v) => v + 5)}
            className="rounded-full border border-stone-200 bg-white px-5 py-2 text-sm font-medium text-stone-700 hover:border-stone-300"
          >
            Load more
          </button>
        </div>
      )}
    </main>
  );
}

export default function FeedPage() {
  return (
    <Suspense>
      <FeedInner />
    </Suspense>
  );
}
