"use client";

import { Fragment, useMemo, useState } from "react";
import { type FeedItem, type EventFeedItem, type SharePostFeedItem } from "@/lib/demo-feed";
import { EventFeedCard } from "@/components/feed/EventFeedCard";
import { VendorPostCard } from "@/components/feed/VendorPostCard";
import { CommunityPostCard } from "@/components/feed/CommunityPostCard";
import { MerchCard } from "@/components/feed/MerchCard";
import { EventsCard } from "@/components/feed/EventsCard";
import { useEventsFeed, usePosts } from "@/lib/data-hooks";

// "3h ago" / "2d ago" / "Just now" from an ISO timestamp.
function relativeTime(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "";
  const diff = Date.now() - ms;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}

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

  // Shared, cached datasets — the /api/events/feed and /api/posts keys are the
  // same ones CommunityEventsLive / the Home feed use, so a single Home visit
  // makes one request each (not 2-3) and returning to the tab paints instantly.
  const { events: rawEvents } = useEventsFeed();
  const { posts: rawPosts } = usePosts();

  // Real events created in-app sort ahead of the demo feed.
  const realEvents = useMemo<EventFeedItem[]>(
    () =>
      rawEvents.map((e, i) => ({
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
      })),
    [rawEvents]
  );

  // Real community share posts (from the share composer / posts table). These
  // also appear on the tagged entity's memories wall — this is their timeline
  // surface. Media-less posts still show (text-only updates are fine in a feed).
  const realPosts = useMemo<SharePostFeedItem[]>(
    () =>
      eventsOnly
        ? [] // the events-only view never shows posts
        : rawPosts.map((p, i) => ({
            id: `post-${p.id}`,
            postId: p.id,
            kind: "share",
            author: { id: p.author_name ?? "someone", name: p.author_name ?? "Someone", type: "shopper" },
            postedAt: relativeTime(p.created_at),
            // Newest first; sits above real events (-1000) so fresh posts lead.
            postedAtOrder: -3000 + i,
            body: p.body ?? "",
            images: p.image_urls?.length ? p.image_urls : undefined,
            videos: p.video_urls?.length ? p.video_urls : undefined,
            taggedMember:
              p.tagged_member_id && p.tagged_member_name
                ? { id: p.tagged_member_id, name: p.tagged_member_name }
                : null,
            taggedEvent:
              p.tagged_event_id && p.tagged_event_title
                ? { id: p.tagged_event_id, title: p.tagged_event_title }
                : null,
            location: p.location ?? null,
            livestreamUrl: p.livestream_url ?? null,
            reactions: p.reactions ?? 0,
            reacted: p.reacted ?? false,
          })),
    [eventsOnly, rawPosts]
  );

  const effectiveFilter: Filter = eventsOnly ? "event" : filter;
  const filtered: FeedItem[] = useMemo(() => {
    const sorted: FeedItem[] = [...realPosts, ...realEvents].sort((a, b) => a.postedAtOrder - b.postedAtOrder);
    if (effectiveFilter === "all") return sorted;
    // "Posts" spans both demo vendor posts and real community share posts.
    if (effectiveFilter === "post") return sorted.filter((i) => i.kind === "post" || i.kind === "share");
    return sorted.filter((i) => i.kind === effectiveFilter);
  }, [effectiveFilter, realEvents, realPosts]);

  const shown = filtered.slice(0, visible);
  const hasMore = visible < filtered.length;

  // Home rail: horizontal scroll of fixed-width cards, no tabs/load-more.
  if (layout === "rail") {
    return (
      <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:-mx-8 md:px-8">
        {filtered.slice(0, 10).map((item) => (
          <div key={item.id} className="w-80 shrink-0 sm:w-96">
            {item.kind === "event" ? (
              <EventFeedCard item={item} />
            ) : item.kind === "share" ? (
              <CommunityPostCard item={item} />
            ) : (
              <VendorPostCard item={item} />
            )}
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
            {item.kind === "event" ? (
              <EventFeedCard item={item} />
            ) : item.kind === "share" ? (
              <CommunityPostCard item={item} />
            ) : (
              <VendorPostCard item={item} />
            )}
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
