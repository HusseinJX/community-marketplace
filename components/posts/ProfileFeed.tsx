"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Camera, Grid3x3, Heart, Users } from "lucide-react";
import { useAuth } from "@clerk/nextjs";
import { useMemories } from "@/lib/data-hooks";
import { youtubeThumb } from "@/lib/embed";
import { PostLightbox } from "@/components/posts/PostLightbox";
import type { Post } from "@/lib/posts";

type Tab = "behind" | "community";

interface Tile {
  post: Post;
  url: string;
  kind: "image" | "video";
}

/**
 * The bottom of a business profile, shaped like an Instagram profile.
 *
 * Two stacked blocks of square grid (they were tabs until 2026-09-29), and
 * the split is the whole point:
 *
 *   Behind the scenes — posted BY the business. The bread at 5am, the new
 *     delivery, the thing that broke. This is what the platform is FOR, and it
 *     leads.
 *   From the community — posted ABOUT the business by everyone else. The
 *     memories wall, which existed first and now sits second ("Tagged").
 *
 * Same rows in `posts`, same wall; `author_id` against the owner's Clerk id is
 * the only thing that separates them. A business with no owner yet (an
 * unclaimed profile) still shows the Posts block, empty.
 */
export function ProfileFeed({
  memberId,
  memberName,
  ownerUserIds,
}: {
  memberId: string;
  memberName: string;
  /** Clerk ids of everyone who claimed this business. Empty if unclaimed. */
  ownerUserIds: string[];
}) {
  const { posts: fetched } = useMemories(memberId);
  const [posts, setPosts] = useState<Post[]>([]);
  const [open, setOpen] = useState<Post | null>(null);
  const { isSignedIn, userId } = useAuth();

  useEffect(() => {
    setPosts(fetched);
  }, [fetched]);

  // A Set, because a business can have several owners and this is checked once
  // per post on every render.
  const owners = useMemo(() => new Set(ownerUserIds), [ownerUserIds]);
  const isOwner = !!userId && owners.has(userId);

  const { behind, community } = useMemo(() => {
    const behind: Post[] = [];
    const community: Post[] = [];
    for (const post of posts) {
      (owners.has(post.author_id) ? behind : community).push(post);
    }
    return { behind, community };
  }, [posts, owners]);

  const tilesOf = (list: Post[]): Tile[] =>
    list.flatMap((post) => [
      ...post.image_urls.map((url) => ({ post, url, kind: "image" as const })),
      ...post.video_urls.map((url) => ({ post, url, kind: "video" as const })),
    ]);

  // Always rendered, even with nothing in it: the section sits under "Our
  // story" on every profile, and an empty one says so rather than vanishing.

  async function react(postId: string) {
    const flip = (p: Post): Post =>
      p.id === postId
        ? { ...p, reacted: !p.reacted, reactions: (p.reactions ?? 0) + (p.reacted ? -1 : 1) }
        : p;
    setPosts((ps) => ps.map(flip));
    setOpen((o) => (o ? flip(o) : o));
    try {
      const res = await fetch(`/api/posts/${postId}/react`, { method: "POST" });
      const d = await res.json();
      if (res.ok) {
        const sync = (p: Post): Post =>
          p.id === postId ? { ...p, reacted: d.reacted, reactions: d.count } : p;
        setPosts((ps) => ps.map(sync));
        setOpen((o) => (o ? sync(o) : o));
      }
    } catch {
      /* keep optimistic state */
    }
  }

  const countOf = (list: Post[]) =>
    list.reduce((n, p) => n + p.image_urls.length + p.video_urls.length, 0);

  // One stacked block per kind, business first: what they posted, then what
  // everyone else tagged them in. (These were two tabs; stacked, a visitor
  // sees both without knowing there was a second one to tap.)
  const block = (kind: Tab, list: Post[]) => {
    const tiles = tilesOf(list);
    return (
      <div>
        <div className="flex items-center justify-center gap-2 border-t border-stone-200 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-stone-900">
          {kind === "behind" ? <Grid3x3 className="h-3.5 w-3.5" /> : <Users className="h-3.5 w-3.5" />}
          {kind === "behind" ? "Posts" : "Tagged"}
          {countOf(list) > 0 && <span className="text-stone-400">{countOf(list)}</span>}
        </div>
        {tiles.length > 0 ? (
          <div className="mt-1 grid grid-cols-3 gap-1 sm:gap-1.5">
            {tiles.map((t, i) => (
              <button
                key={`${t.url}-${i}`}
                onClick={() => setOpen(t.post)}
                className="group relative aspect-square overflow-hidden bg-stone-100 sm:rounded-md"
              >
                {t.kind === "video" ? (
                  youtubeThumb(t.url) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={youtubeThumb(t.url)!}
                      alt=""
                      className="h-full w-full object-cover transition group-hover:scale-105"
                    />
                  ) : (
                    <video src={t.url} muted playsInline className="h-full w-full object-cover" />
                  )
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={t.url}
                    alt=""
                    className="h-full w-full object-cover transition group-hover:scale-105"
                  />
                )}
                {t.kind === "video" && (
                  <span className="absolute right-1.5 top-1.5 rounded bg-black/55 px-1 text-[10px] font-medium text-white">
                    ▶
                  </span>
                )}
                {(t.post.reactions ?? 0) > 0 && (
                  <span className="absolute bottom-1.5 left-1.5 inline-flex items-center gap-0.5 rounded-full bg-black/50 px-1.5 py-0.5 text-[10px] font-medium text-white">
                    <Heart className="h-2.5 w-2.5 fill-current" /> {t.post.reactions}
                  </span>
                )}
              </button>
            ))}
          </div>
        ) : (
          <EmptyGrid tab={kind} isOwner={isOwner} memberId={memberId} memberName={memberName} />
        )}
        {tiles.length > 0 && (
          <div className="mt-3 flex justify-center">
            {kind === "behind" && isOwner ? (
              <Link
                href="/share?vendor=1"
                className="inline-flex items-center gap-2 rounded-full border border-stone-200 px-4 py-2 text-sm font-semibold text-stone-700 transition hover:bg-stone-50"
              >
                <Camera className="h-4 w-4" />
                Post another
              </Link>
            ) : kind === "community" ? (
              <Link
                href={`/share?business=${memberId}&businessName=${encodeURIComponent(memberName)}`}
                className="inline-flex items-center gap-2 rounded-full border border-stone-200 px-4 py-2 text-sm font-semibold text-stone-700 transition hover:bg-stone-50"
              >
                <Camera className="h-4 w-4" />
                Add yours
              </Link>
            ) : null}
          </div>
        )}
      </div>
    );
  };

  return (
    <section className="space-y-8">
      {/* Always both, Posts first — an unclaimed profile gets its "No posts
          to show yet." too, so Tagged sits in the same place on every page. */}
      {block("behind", behind)}
      {block("community", community)}

      {open && (
        <PostLightbox
          post={open}
          onClose={() => setOpen(null)}
          onReact={() => react(open.id)}
          canReact={!!isSignedIn}
          onModerated={() => {
            setPosts((ps) => ps.filter((p) => p.author_id !== open.author_id && p.id !== open.id));
            setOpen(null);
          }}
        />
      )}
    </section>
  );
}

function EmptyGrid({
  tab,
  isOwner,
  memberId,
  memberName,
}: {
  tab: Tab;
  isOwner: boolean;
  memberId: string;
  memberName: string;
}) {
  // The owner's empty behind-the-scenes grid is the most valuable space on the
  // page: it is the one moment we get to say what this feed is for. Say it
  // concretely — "post something" teaches nobody what to photograph.
  if (tab === "behind" && isOwner) {
    return (
      <div className="mt-1 rounded-2xl border border-dashed border-stone-300 bg-white px-6 py-10 text-center">
        <Camera className="mx-auto h-6 w-6 text-stone-300" />
        <p className="mt-3 text-sm font-semibold text-stone-950">Show people the back of house</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-stone-500">
          The dough at 5am. The delivery coming in. The thing that broke on a
          Tuesday. People follow the work, not the storefront.
        </p>
        <Link
          href={`/share?vendor=1`}
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-stone-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-stone-800"
        >
          <Camera className="h-4 w-4" />
          Post the first one
        </Link>
      </div>
    );
  }

  if (tab === "behind") {
    return (
      <div className="mt-1 rounded-2xl border border-dashed border-stone-300 bg-white px-6 py-10 text-center">
        <p className="text-sm text-stone-500">No posts to show yet.</p>
      </div>
    );
  }

  return (
    <div className="mt-1 rounded-2xl border border-dashed border-stone-300 bg-white px-6 py-10 text-center">
      <p className="text-sm text-stone-500">No posts to show yet.</p>
      <p className="mt-1 text-sm text-stone-500">Been here? Your photo would be the first.</p>
      <Link
        href={`/share?business=${memberId}&businessName=${encodeURIComponent(memberName)}`}
        className="mt-4 inline-flex items-center gap-2 rounded-full border border-stone-200 px-4 py-2.5 text-sm font-semibold text-stone-700 transition hover:bg-stone-50"
      >
        <Camera className="h-4 w-4" />
        Post a photo
      </Link>
    </div>
  );
}
