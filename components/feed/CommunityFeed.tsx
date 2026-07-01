"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { DEMO_FEED, type FeedItem, type EventFeedItem } from "@/lib/demo-feed";
import { EventFeedCard } from "@/components/feed/EventFeedCard";
import { VendorPostCard } from "@/components/feed/VendorPostCard";
import { MerchCard } from "@/components/feed/MerchCard";
import { EventsCard } from "@/components/feed/EventsCard";

type Filter = "all" | "event" | "post";
const TABS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "event", label: "Events" },
  { id: "post", label: "Vendor Posts" },
];

// The social community feed — events + vendor posts + featured merch/events.
// Reused by the /events page (vertical "feed") and folded into the home scroll
// as a horizontal "rail" (matching the other home sections).
export function CommunityFeed({
  eventsOnly = false,
  layout = "feed",
}: {
  eventsOnly?: boolean;
  layout?: "feed" | "rail";
}) {
  const [filter, setFilter] = useState<Filter>(eventsOnly ? "event" : "all");
  const [visible, setVisible] = useState(5);
  const [realEvents, setRealEvents] = useState<EventFeedItem[]>([]);

  // Real events created in-app sort ahead of the demo feed; falls back silently
  // to demo-only when the API is unavailable.
  useEffect(() => {
    fetch("/api/events/feed")
      .then((r) => (r.ok ? r.json() : { events: [] }))
      .then((d: { events?: Array<Record<string, string | null>> }) => {
        const items: EventFeedItem[] = (d.events ?? []).map((e, i) => ({
          id: `real-${e.eventId}`,
          kind: "event",
          eventId: String(e.eventId),
          title: String(e.title ?? "Event"),
          date: String(e.date ?? ""),
          location: String(e.location ?? ""),
          description: String(e.description ?? ""),
          images: e.image ? [String(e.image)] : undefined,
          author: { id: String(e.memberId ?? ""), name: String(e.memberName ?? "Organizer"), type: "organizer" },
          postedAt: "Just now",
          postedAtOrder: -1000 + i,
        }));
        setRealEvents(items);
      })
      .catch(() => {});
  }, []);

  const effectiveFilter: Filter = eventsOnly ? "event" : filter;
  const filtered: FeedItem[] = useMemo(() => {
    const realIds = new Set(realEvents.map((e) => e.eventId));
    const demo = DEMO_FEED.filter((i) => i.kind !== "event" || !realIds.has(i.eventId));
    const sorted = [...realEvents, ...demo].sort((a, b) => a.postedAtOrder - b.postedAtOrder);
    if (effectiveFilter === "all") return sorted;
    return sorted.filter((i) => i.kind === effectiveFilter);
  }, [effectiveFilter, realEvents]);

  const shown = filtered.slice(0, visible);
  const hasMore = visible < filtered.length;

  // Home rail: horizontal scroll of fixed-width cards, no tabs/load-more.
  if (layout === "rail") {
    return (
      <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:-mx-8 md:px-8">
        {filtered.slice(0, 10).map((item) => (
          <div key={item.id} className="w-80 shrink-0 sm:w-96">
            {item.kind === "event" ? <EventFeedCard item={item} /> : <VendorPostCard item={item} />}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      {!eventsOnly && (
        <div className="mb-6 -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
          {TABS.map((t) => {
            const active = filter === t.id;
            return (
              <button
                key={t.id}
                onClick={() => { setFilter(t.id); setVisible(5); }}
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
        {shown.map((item, i) => (
          <Fragment key={item.id}>
            {item.kind === "event" ? <EventFeedCard item={item} /> : <VendorPostCard item={item} />}
            {/* Official WhatsLocal merch after the 3rd card, events after the 6th */}
            {i === 2 && <MerchCard />}
            {i === 5 && <EventsCard />}
          </Fragment>
        ))}
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
    </div>
  );
}
