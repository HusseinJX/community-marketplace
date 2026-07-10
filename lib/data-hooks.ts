"use client";

import useSWR from "swr";
import type { Member } from "@/lib/types";
import type { LiveBroadcast } from "@/components/live/types";
import type { FeedEvent } from "@/app/api/events/feed/route";
import type { Post } from "@/lib/posts";
import { fetchLiveBroadcasts } from "@/lib/demo-live-fixtures";

// Shared, cached data hooks. Every surface that needs one of these datasets
// pulls from the SAME SWR key, so:
//  - the cache survives tab switches (instant paint on return, no refetch),
//  - concurrent callers on one screen dedupe into a single request,
//  - one background revalidation refreshes every consumer at once.
// Previously each component fetched independently in its own useEffect with no
// sharing, so a single Home visit could hit /api/events/feed 2-3 times and
// re-hit everything on every navigation.

// Shape returned by GET /api/posts — kept loose; only rendered fields are read.
export interface ApiPost {
  id: string;
  author_name: string | null;
  body: string | null;
  image_urls?: string[];
  video_urls?: string[];
  tagged_member_id?: string | null;
  tagged_member_name?: string | null;
  tagged_event_id?: string | null;
  tagged_event_title?: string | null;
  livestream_url?: string | null;
  location?: string | null;
  created_at: string;
  reactions?: number;
  reacted?: boolean;
}

/** Live venue broadcasts (real, else real-games+demo-venues fallback). Polls. */
export function useBroadcasts() {
  const { data, isLoading, mutate } = useSWR<LiveBroadcast[]>(
    "/api/broadcasts",
    fetchLiveBroadcasts,
    // Live surfaces stay fresh — broadcasts start and expire on their own.
    { refreshInterval: 60_000 }
  );
  return { broadcasts: data ?? [], loading: isLoading && !data, refresh: mutate };
}

/** Public community events feed (real vendor_events + connector events). */
export function useEventsFeed() {
  const { data, isLoading } = useSWR<{ events?: FeedEvent[] }>("/api/events/feed");
  return { events: data?.events ?? [], loading: isLoading && !data };
}

/** Community share posts (from the share composer / posts table). */
export function usePosts() {
  const { data, isLoading } = useSWR<{ posts?: ApiPost[] }>("/api/posts");
  return { posts: data?.posts ?? [], loading: isLoading && !data };
}

/** Local member directory (home "Who's local" rail + /explore share one key). */
export function useDirectory() {
  const { data, isLoading } = useSWR<{ members?: Member[] }>("/api/directory");
  return { members: data?.members ?? [], loading: isLoading && !data };
}

/**
 * Superadmin-curated home rails. FeaturedLists (home) and FeaturedDetail
 * (/featured/[id]) share this one key, so opening "See all" is instant.
 * Generic over the list shape the caller casts to.
 */
export function useFeatured<T = unknown>() {
  const { data, isLoading } = useSWR<{ lists?: T[] }>("/api/featured");
  return { lists: data?.lists ?? [], loading: isLoading && !data };
}

/** One live broadcast by id (the /live/[id] detail page). */
export function useBroadcast(id: string) {
  const { data, isLoading } = useSWR<{ broadcast?: LiveBroadcast | null }>(
    id ? `/api/broadcasts/view/${id}` : null
  );
  return { broadcast: data?.broadcast ?? null, loading: isLoading && !data };
}

/**
 * The "memories" wall for one entity — posts tagged to a member or event.
 * Conditional key: null (skips fetch) when neither id is set. Each entity is
 * cached separately, so revisiting a profile/event paints instantly.
 */
export function useMemories(memberId?: string, eventId?: string) {
  const qs = memberId
    ? `member=${encodeURIComponent(memberId)}`
    : eventId
      ? `event=${encodeURIComponent(eventId)}`
      : "";
  const { data } = useSWR<{ posts?: Post[] }>(qs ? `/api/posts?${qs}` : null);
  return { posts: data?.posts ?? [] };
}
