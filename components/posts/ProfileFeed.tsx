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
 * Two tabs over one square grid, and the split is the whole point:
 *
 *   Behind the scenes — posted BY the business. The bread at 5am, the new
 *     delivery, the thing that broke. This is what the platform is FOR, and it
 *     leads.
 *   From the community — posted ABOUT the business by everyone else. The
 *     memories wall, which existed first and is now the second tab.
 *
 * Same rows in `posts`, same wall; `author_id` against the owner's Clerk id is
 * the only thing that separates them. A business with no owner yet (an
 * unclaimed profile) has no behind-the-scenes tab at all — there is nobody who
 * could have posted it.
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
  const [tab, setTab] = useState<Tab>("behind");
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

  // Open on whichever tab has something in it. A business that only has
  // customer photos shouldn't greet everyone with an empty grid — but the
  // OWNER should see their empty one, because for them it's the prompt.
  useEffect(() => {
    if (!isOwner && behind.length === 0 && community.length > 0) setTab("community");
  }, [isOwner, behind.length, community.length]);

  const active = tab === "behind" ? behind : community;
  const tiles: Tile[] = active.flatMap((post) => [
    ...post.image_urls.map((url) => ({ post, url, kind: "image" as const })),
    ...post.video_urls.map((url) => ({ post, url, kind: "video" as const })),
  ]);

  // Nothing at all, and nobody who could fix it → render nothing, exactly as
  // the memories wall used to.
  if (posts.length === 0 && !isOwner) return null;

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

  return (
    <section>
      {/* Tabs, centred and evenly split — the Instagram profile bar. */}
      <div className="flex border-t border-stone-200">
        {(
          [
            { key: "behind" as const, label: "Behind the scenes", icon: Grid3x3, list: behind },
            { key: "community" as const, label: "From the community", icon: Users, list: community },
          ]
        )
          // Hide the behind-the-scenes tab entirely when nobody owns the page:
          // an empty tab on an unclaimed profile reads as a business that
          // never posts, rather than one that hasn't arrived yet.
          .filter((t) => t.key !== "behind" || owners.size > 0)
          .map(({ key, label, icon: Icon, list }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`flex flex-1 items-center justify-center gap-2 border-t-2 px-2 py-3 text-xs font-semibold uppercase tracking-[0.08em] transition ${
                tab === key
                  ? "border-stone-900 text-stone-900"
                  : "border-transparent text-stone-400 hover:text-stone-600"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{label}</span>
              <span className="sm:hidden">{key === "behind" ? "Posts" : "Tagged"}</span>
              {countOf(list) > 0 && <span className="text-stone-400">{countOf(list)}</span>}
            </button>
          ))}
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
        <EmptyGrid tab={tab} isOwner={isOwner} memberId={memberId} memberName={memberName} />
      )}

      {/* The way in, for a grid that already has something in it. The empty
          states carry their own call to action; this is the one that used to
          live above the wall as "Been here? Post a photo" and would otherwise
          have disappeared the moment a single photo existed. */}
      {tiles.length > 0 && (
        <div className="mt-3 flex justify-center">
          {tab === "behind" && isOwner ? (
            <Link
              href="/share?vendor=1"
              className="inline-flex items-center gap-2 rounded-full border border-stone-200 px-4 py-2 text-sm font-semibold text-stone-700 transition hover:bg-stone-50"
            >
              <Camera className="h-4 w-4" />
              Post another
            </Link>
          ) : tab === "community" ? (
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
        <p className="text-sm text-stone-500">
          {memberName} hasn&apos;t posted behind the scenes yet.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-1 rounded-2xl border border-dashed border-stone-300 bg-white px-6 py-10 text-center">
      <p className="text-sm font-semibold text-stone-950">Been here?</p>
      <p className="mt-1 text-sm text-stone-500">Your photo would be the first.</p>
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
