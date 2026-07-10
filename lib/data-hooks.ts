"use client";

import useSWR from "swr";
import type { Member } from "@/lib/types";
import type { LiveBroadcast } from "@/components/live/types";
import type { FeedEvent } from "@/app/api/events/feed/route";
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
