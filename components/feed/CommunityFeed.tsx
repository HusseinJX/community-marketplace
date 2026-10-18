"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { Rows3, LayoutGrid } from "lucide-react";
import { type FeedItem, type EventFeedItem, type SharePostFeedItem, type AutoFeedItem } from "@/lib/demo-feed";
import { EventFeedCard } from "@/components/feed/EventFeedCard";
import { VendorPostCard } from "@/components/feed/VendorPostCard";
import { CommunityPostCard } from "@/components/feed/CommunityPostCard";
import { AutoFeedCard } from "@/components/feed/AutoFeedCard";
import { MasonryColumns } from "@/components/feed/MasonryColumns";
import { MerchCard } from "@/components/feed/MerchCard";
import { EventsCard } from "@/components/feed/EventsCard";
import { CommunityChatCard } from "@/components/community/CommunityChatCard";
import { useEventsFeed, useFeedItems, usePosts } from "@/lib/data-hooks";
import { useHomePosition } from "@/lib/home-position";
import { byDistance, milesTo } from "@/lib/proximity";
import { DEMO_COMMUNITY_CHATS } from "@/lib/demo-community-chats";

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

// Which scroll position each community chat is tucked behind. Explicit rather
// than computed because they have to dodge the merch (2) and events (5)
// interstitials — two inserted cards back to back reads as an ad break. The
// first is early enough to be met without hunting; the rest arrive over
// successive "Load more"s, which is the pace you'd find them at anyway.
const CHAT_SLOT_INDEXES = [1, 7, 11, 15];
// Seeded WhatsLocal items fill the feed up to this many slots, minus one for
// every real post — so they RETREAT as people post, with nobody deciding when
// to turn them off (features/community-feed-seeding.md, "The retreat rule").
// At AUTO_FILL real posts there are none.
const AUTO_FILL = 10;

// Feed items on the first screen. With the merch and chat cards slotted in
// between, 4 items make 6 cards — two rows of three on desktop.
const FIRST_PAGE = 4;

const CHAT_SLOTS = new Map(
  DEMO_COMMUNITY_CHATS.map((chat, i) => [CHAT_SLOT_INDEXES[i] ?? 19 + i * 4, chat])
);

// Chats sits here rather than as its own home tab: a community chat is another
// kind of community post, and promoting it to a top-level destination made the
// home row four wide on a phone for content that belongs beside the posts.
export type CommunityFeedFilter = "all" | "shopper" | "vendor" | "chats";
export type CommunityFeedView = "list" | "board";
export const COMMUNITY_FEED_FILTERS: { id: CommunityFeedFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "shopper", label: "Shoppers" },
  { id: "vendor", label: "Vendors" },
  { id: "chats", label: "Chats" },
];

// The social community feed — events + vendor posts + featured merch/events.
// Reused by the /events page (vertical "feed") and folded into the home scroll
// as a horizontal "rail" (matching the other home sections).
export function CommunityFeed({
  eventsOnly = false,
  layout = "feed",
  filter,
  onFilterChange,
  showFilterTabs = true,
  view,
  onViewChange,
  withEvents = true,
}: {
  eventsOnly?: boolean;
  /**
   * Whether the event list follows the posts. The home Feed tab turns this off
   * (2026-10-18): with it on, Feed was ~120 events after a handful of posts —
   * a second copy of the Events tab, which made both read thinner. /events
   * keeps it.
   */
  withEvents?: boolean;
  layout?: "feed" | "rail";
  filter?: CommunityFeedFilter;
  onFilterChange?: (filter: CommunityFeedFilter) => void;
  showFilterTabs?: boolean;
  view?: CommunityFeedView;
  onViewChange?: (view: CommunityFeedView) => void;
}) {
  const [ownFilter, setOwnFilter] = useState<CommunityFeedFilter>("all");
  const activeFilter = filter ?? ownFilter;
  const [visible, setVisible] = useState(FIRST_PAGE);
  // "list" = a single narrow column (more vertical); "board" = a Pinterest-style
  // masonry (up to 3 columns on desktop).
  const [ownView, setOwnView] = useState<CommunityFeedView>("board");
  const activeView = view ?? ownView;

  const setFilter = (next: CommunityFeedFilter) => {
    setVisible(FIRST_PAGE);
    if (onFilterChange) onFilterChange(next);
    else setOwnFilter(next);
  };
  const setView = (next: CommunityFeedView) => {
    if (onViewChange) onViewChange(next);
    else setOwnView(next);
  };

  useEffect(() => {
    setVisible(FIRST_PAGE);
  }, [activeFilter]);

  // Shared, cached datasets — the /api/events/feed and /api/posts keys are the
  // same ones CommunityEventsLive / the Home feed use, so a single Home visit
  // makes one request each (not 2-3) and returning to the tab paints instantly.
  const { events: rawEvents } = useEventsFeed();
  const { posts: rawPosts } = usePosts();
  const { items: rawAuto } = useFeedItems();
  // Shared home position — the same one lookup the city header and the events
  // feed use, so this adds no second permission dialog.
  const { position } = useHomePosition();

  // Posts nearest-first once we know where the reader is.
  //
  // Only posts written from 2026-08-05 carry coordinates; everything older is
  // unplaceable and stays where recency put it, at the back of the placed ones.
  // The list arrives newest-first, so recency remains both the tiebreak and the
  // fallback. An unplaced post shows no distance rather than a guessed one.
  const ranked = useMemo(() => {
    const measured = rawPosts.map((p) => ({
      p,
      miles: milesTo(position, { latitude: p.lat, longitude: p.lng }),
    }));
    if (!position) return measured;
    return [...measured].sort((a, b) => byDistance(a.miles, b.miles));
  }, [rawPosts, position]);

  // Real events created in-app sort ahead of the demo feed.
  const realEvents = useMemo<EventFeedItem[]>(
    () =>
      (withEvents || eventsOnly ? rawEvents : []).map((e, i) => ({
        id: `real-${e.eventId}`,
        kind: "event",
        eventId: String(e.eventId),
        title: String(e.title ?? "Event"),
        date: String(e.date ?? ""),
        location: String(e.location ?? ""),
        description: String(e.description ?? ""),
        images: e.image ? [String(e.image)] : undefined,
        author: { id: String(e.memberId ?? ""), name: String(e.memberName ?? "Organizer"), type: "organizer" },
        sourceId: e.sourceId ?? null,
        eventUrl: e.eventUrl ?? null,
        postedAt: "Just now",
        // Community events lead; harvested ones sit behind them. "Just now" is
        // true of an organizer posting, but meaningless for a calendar we read.
        postedAtOrder: (e.sourceId ? -500 : -1000) + i,
      })),
    [rawEvents, withEvents, eventsOnly]
  );

  // Real community share posts (from the share composer / posts table). These
  // also appear on the tagged entity's memories wall — this is their timeline
  // surface. Media-less posts still show (text-only updates are fine in a feed).
  const realPosts = useMemo<SharePostFeedItem[]>(
    () =>
      eventsOnly
        ? [] // the events-only view never shows posts
        : ranked.map(({ p, miles }, i) => ({
            id: `post-${p.id}`,
            postId: p.id,
            authorId: p.author_id ?? null,
            kind: "share",
            author: { id: p.author_name ?? "someone", name: p.author_name ?? "Someone", type: "shopper" },
            postedAt: relativeTime(p.created_at),
            // Keeps the ranked order above (nearest first, else newest) and
            // sits above real events (-1000) so community posts lead.
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
            miles,
            livestreamUrl: p.livestream_url ?? null,
            reactions: p.reactions ?? 0,
            reacted: p.reacted ?? false,
          })),
    [eventsOnly, ranked]
  );

  // WhatsLocal items sit BELOW every real post (-3000…) and above events
  // (-1000…). Never above a real post, whatever their date.
  const autoItems = useMemo<AutoFeedItem[]>(() => {
    if (eventsOnly) return [];
    const room = Math.max(0, AUTO_FILL - realPosts.length);
    return rawAuto.slice(0, room).map((a, i) => ({
      id: `auto-${a.id}`,
      kind: "auto",
      author: { id: "whatslocal", name: "WhatsLocal", type: "organizer" },
      postedAt: relativeTime(a.published_at),
      postedAtOrder: -2000 + i,
      layer: a.layer,
      title: a.title,
      body: a.body,
      image: a.image_url,
      linkUrl: a.link_url,
      linkLabel: a.link_label,
      eventId: a.event_id,
      eventDate: a.event_date,
      venue: a.venue,
      neighborhood: a.neighborhood,
      miles: milesTo(position, { latitude: a.lat, longitude: a.lng }),
    }));
  }, [eventsOnly, rawAuto, realPosts.length, position]);

  const filtered: FeedItem[] = useMemo(() => {
    const sorted: FeedItem[] = [...realPosts, ...autoItems, ...realEvents].sort((a, b) => a.postedAtOrder - b.postedAtOrder);
    if (eventsOnly) return sorted.filter((i) => i.kind === "event");
    // Shoppers = community share posts; Vendors = business content (events +
    // vendor posts). "All" shows everything.
    if (activeFilter === "shopper") return sorted.filter((i) => i.kind === "share");
    if (activeFilter === "vendor") return sorted.filter((i) => i.kind === "event" || i.kind === "post");
    // Chats is not a slice of the post stream — it is its own grid, rendered
    // below instead of this list.
    if (activeFilter === "chats") return [];
    return sorted;
  }, [eventsOnly, activeFilter, realEvents, realPosts, autoItems]);

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
            ) : item.kind === "auto" ? (
              <AutoFeedCard item={item} />
            ) : (
              <VendorPostCard item={item} />
            )}
          </div>
        ))}
      </div>
    );
  }

  const boardView = activeView === "board";

  // Every card in order — feed items plus the cards slotted between them.
  const PAGE = 5;
  const cells: { key: string; node: React.ReactNode }[] = [];
  shown.forEach((item, i) => {
    cells.push({
      key: item.id,
      node:
        item.kind === "event" ? (
          <EventFeedCard item={item} />
        ) : item.kind === "share" ? (
          <CommunityPostCard item={item} />
        ) : item.kind === "auto" ? (
          <AutoFeedCard item={item} />
        ) : (
          <VendorPostCard item={item} />
        ),
    });
    // Official WhatsLocal merch after the 3rd card.
    if (i === 2) cells.push({ key: "merch", node: <MerchCard /> });
    // Community chats are seeded through the scroll rather than given a section
    // of their own — you're meant to come across one, not go looking for a list.
    // Each card hides itself unless you're near it (empty:hidden).
    const chat = CHAT_SLOTS.get(i);
    if (chat) {
      cells.push({
        key: `chat-${chat.id}`,
        node: (
          <div className="empty:hidden">
            <CommunityChatCard chat={chat} />
          </div>
        ),
      });
    }
  });
  // The Events promo closes the feed — once everything is loaded. It used to
  // sit after the 6th card, which a short feed never reaches.
  if (!hasMore && shown.length > 0) cells.push({ key: "atlas", node: <EventsCard /> });

  return (
    <div>
      {!eventsOnly && showFilterTabs && (
        <div className="mb-6 flex items-center justify-between gap-3">
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
            {COMMUNITY_FEED_FILTERS.map((t) => {
              const active = activeFilter === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => { setFilter(t.id); setVisible(FIRST_PAGE); }}
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

          {/* List / board (masonry) toggle — a board is nicer on wide desktops;
              hidden on mobile where the board collapses to one column anyway. */}
          <div className="hidden shrink-0 items-center gap-0.5 rounded-full border border-stone-200 bg-white p-0.5 sm:flex">
            <button
              type="button"
              onClick={() => setView("list")}
              aria-label="List view"
              aria-pressed={!boardView}
              className={`inline-flex h-8 w-8 items-center justify-center rounded-full transition ${
                !boardView ? "bg-stone-900 text-white" : "text-stone-500 hover:text-stone-800"
              }`}
            >
              <Rows3 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setView("board")}
              aria-label="Board view"
              aria-pressed={boardView}
              className={`inline-flex h-8 w-8 items-center justify-center rounded-full transition ${
                boardView ? "bg-stone-900 text-white" : "text-stone-500 hover:text-stone-800"
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Chats gets a grid of its own. Everywhere else they are seeded through
          the scroll to be come across; picking the pill is going looking for
          them, and that deserves the whole list at once. */}
      {activeFilter === "chats" && (
        <div className="mx-auto max-w-2xl">
          <p className="mb-4 text-sm text-stone-500">
            Group chats rooted to a place. Drop in, see what&apos;s going on, star the ones you
            want to come back to.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {DEMO_COMMUNITY_CHATS.map((chat) => (
              <CommunityChatCard key={chat.id} chat={chat} />
            ))}
          </div>
        </div>
      )}

      {boardView ? (
        // Masonry that only grows at the bottom: "Load more" continues each
        // column under its last card; nothing already on screen moves.
        <MasonryColumns items={cells} />      ) : (
        <div
          className={
            // Phone: every card wears the Events tab's card shell — inside the
            // gutter, rounded-xl, no shadow, 8px apart —
            // so switching tabs doesn't change what a card looks like.
            // md+: the centred column of cards.
            "mx-auto max-w-2xl space-y-4 max-md:space-y-2 max-md:[&>*]:rounded-xl max-md:[&>*]:shadow-none"
          }
        >
          {cells.map((cell) => (
            <Fragment key={cell.key}>{cell.node}</Fragment>
          ))}
        </div>
      )}

      {shown.length === 0 && activeFilter !== "chats" && (
        <p className="py-16 text-center text-sm text-stone-500">Nothing here yet.</p>
      )}

      {hasMore && (
        <div className="mt-6 flex justify-center">
          <button
            onClick={() => setVisible((v) => v + PAGE)}
            className="rounded-full border border-stone-200 bg-white px-5 py-2 text-sm font-medium text-stone-700 hover:border-stone-300"
          >
            Load more
          </button>
        </div>
      )}
    </div>
  );
}
