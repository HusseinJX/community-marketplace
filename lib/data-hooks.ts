"use client";

import { useCallback, useMemo } from "react";
import useSWR from "swr";
import type { Member } from "@/lib/types";
import type { LiveBroadcast } from "@/components/live/types";
import type { FeedEvent } from "@/app/api/events/feed/route";
import type { Post } from "@/lib/posts";
import type { Activity } from "@/lib/unread";
import type { CollaborationSummary } from "@/lib/collab-network";
import { fetchLiveBroadcasts } from "@/lib/demo-live-fixtures";

// Shared, cached data hooks. Every surface that needs one of these datasets
// pulls from the SAME SWR key, so:
//  - the cache survives tab switches (instant paint on return, no refetch),
//  - concurrent callers on one screen dedupe into a single request,
//  - one background revalidation refreshes every consumer at once.
// Previously each component fetched independently in its own useEffect with no
// sharing, so a single Home visit could hit /api/events/feed 2-3 times and
// re-hit everything on every navigation.

// EVERY "no data yet" return below hands back the same `NONE` array (declared
// with its siblings at the bottom of the file).
//
// `data?.posts ?? []` looks harmless and is not: it is a NEW array on every
// render, so anything using it as a dependency re-runs forever. It caused a
// real infinite render loop — MemoriesGrid copies `posts` into state in an
// effect keyed on it, so every event or member page with nothing tagged to it
// yet spun on "Maximum update depth exceeded" until the tab was closed.
// Downstream useMemos were quietly recomputing every render for the same
// reason. A module-level constant is referentially stable, so one empty result
// equals the last one.

// Shape returned by GET /api/posts — kept loose; only rendered fields are read.
export interface ApiPost {
  id: string;
  author_id?: string | null;
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
  /** Where it was posted. Null on anything written before 2026-08-05 — the
   *  label above is a neighbourhood name, not something measurable. */
  lat?: number | null;
  lng?: number | null;
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
  return { broadcasts: data ?? NONE, loading: isLoading && !data, refresh: mutate };
}

/** Public community events feed (real vendor_events + connector events). */
export function useEventsFeed() {
  const { data, isLoading } = useSWR<{ events?: FeedEvent[] }>("/api/events/feed");
  return { events: data?.events ?? NONE, loading: isLoading && !data };
}

/** Community share posts (from the share composer / posts table). */
export function usePosts() {
  const { data, isLoading } = useSWR<{ posts?: ApiPost[] }>("/api/posts");
  return { posts: data?.posts ?? NONE, loading: isLoading && !data };
}

/** Local member directory (home "Who's local" rail + /explore share one key). */
export function useDirectory() {
  const { data, isLoading } = useSWR<{ members?: Member[] }>("/api/directory");
  return { members: data?.members ?? NONE, loading: isLoading && !data };
}

/**
 * Superadmin-curated home rails. FeaturedLists (home) and FeaturedDetail
 * (/featured/[id]) share this one key, so opening "See all" is instant.
 * Generic over the list shape the caller casts to.
 */
export function useFeatured<T = unknown>() {
  const { data, isLoading } = useSWR<{ lists?: T[] }>("/api/featured");
  return { lists: data?.lists ?? NONE, loading: isLoading && !data };
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
  return { posts: data?.posts ?? NONE };
}

/**
 * Message activity powering the unread badges (collab rooms + customer DMs).
 * Cached like everything else here, so returning to Messages paints the badges
 * from cache immediately instead of popping them in after a fresh round-trip.
 * Revalidates in the background every 30s.
 */
export function useVendorActivity(memberId: string, isAdmin: boolean) {
  const { data } = useSWR<{ collab?: Activity[]; customer?: Activity[] }>(
    memberId ? `/api/vendor/activity${isAdmin ? `?memberId=${encodeURIComponent(memberId)}` : ""}` : null,
    { refreshInterval: 30_000 },
  );
  return { collab: data?.collab ?? EMPTY, customer: data?.customer ?? EMPTY, loaded: !!data };
}

// The actor's collaborations. Shared key with the Messages tab, so the
// dashboard's "Needs you" list and the Collaborations cards paint from one
// fetch and agree on what's outstanding.
export function useCollaborations(memberId: string | null | undefined, isAdmin: boolean) {
  const { data } = useSWR<{ collaborations?: CollaborationSummary[] }>(
    memberId ? `/api/vendor/collaborations${isAdmin ? `?memberId=${encodeURIComponent(memberId)}` : ""}` : null,
    { refreshInterval: 30_000 },
  );
  return { collaborations: data?.collaborations ?? EMPTY_COLLABS, loaded: !!data };
}

/**
 * The viewer's starred events, as a Set of event ids.
 *
 * ONE request for the whole list, shared by every card on the page through the
 * SWR key — the alternative (each star asking the server about itself) turns a
 * 60-card feed into 60 requests. `toggle` writes optimistically and rolls back
 * on failure, because a star that waits for a round trip before filling in
 * feels broken even when it works.
 */
export function useSavedEvents() {
  const { data, mutate, isLoading } = useSWR<{ eventIds?: string[] }>("/api/saved-events");
  const ids = data?.eventIds ?? NONE;
  const saved = useMemo(() => new Set(ids), [ids]);

  const toggle = useCallback(
    async (eventId: string) => {
      const next = !saved.has(eventId);
      const optimistic = next
        ? [eventId, ...ids.filter((id) => id !== eventId)]
        : ids.filter((id) => id !== eventId);
      // No revalidate on the optimistic write: the server is about to be asked
      // anyway, and a concurrent GET would race the POST and flicker it back.
      await mutate({ eventIds: optimistic }, { revalidate: false });
      try {
        const res = await fetch("/api/saved-events", {
          method: next ? "POST" : "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ eventId }),
        });
        if (!res.ok) throw new Error("failed");
        return next;
      } catch {
        await mutate(); // roll back to the truth
        return !next;
      }
    },
    [saved, ids, mutate],
  );

  return { saved, savedIds: ids, toggle, loading: isLoading && !data };
}

// Stable identity so consumers' useMemo deps don't churn on every render.
const NONE: never[] = [];
const EMPTY: Activity[] = [];
const EMPTY_COLLABS: CollaborationSummary[] = [];

// ── Personalised events feed ─────────────────────────────────────────────────

export interface PersonalizeParams {
  text: string;
  topics: string[];
  freeOnly: boolean;
  organizer: string | null;
  lat: number | null;
  lng: number | null;
  maxMiles: number | null;
}

/**
 * The "For you" feed.
 *
 * SWR rather than a useEffect+fetch, for the reason this whole file exists: the
 * Events tab unmounts whenever you switch tabs or open an event, so a hand-rolled
 * fetch-on-mount re-ran the whole request — including a model call — every single
 * time you came back. Keyed on the request itself, so returning to an unchanged
 * feed paints from cache instantly and every distinct filter combination keeps
 * its own cached answer.
 *
 * POST because the request carries a sentence and a coordinate pair; the key is
 * the serialised body, which is what makes two identical requests one request.
 */
export function usePersonalizedEvents(p: PersonalizeParams) {
  const body = JSON.stringify(p);
  const { data, isLoading, error } = useSWR(
    ["events-personalize", body],
    ([, payload]: [string, string]) =>
      fetch("/api/events/personalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
      }).then(async (r) => {
        if (!r.ok) {
          const b = await r.json().catch(() => ({}));
          throw new Error(b.error ?? "Could not load your feed");
        }
        return r.json();
      }),
    {
      // The feed changes a few times a day, not a few times a minute, and every
      // miss with text in the box costs a model call.
      dedupingInterval: 5 * 60_000,
      // Cached data is served as-is on remount. NOT revalidateOnMount:false —
      // that would also suppress the very first fetch, leaving an empty feed.
      revalidateIfStale: false,
    },
  );
  return { data, loading: isLoading, error: error as Error | undefined };
}
