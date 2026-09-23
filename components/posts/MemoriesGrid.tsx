"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Images, Heart } from "lucide-react";
import { useAuth } from "@clerk/nextjs";
import { useMemories } from "@/lib/data-hooks";
import { youtubeThumb } from "@/lib/embed";
import { PostLightbox } from "@/components/posts/PostLightbox";
import type { Post } from "@/lib/posts";

type Tile = {
  post: Post;
  url: string;
  kind: "image" | "video";
};

// A shared "memories" wall — everyone's media that was tagged to one business
// or event, aggregated into one place. Renders nothing until media exists, so
// it's safe to drop on every profile/event page.
export function MemoriesGrid({
  memberId,
  eventId,
  title = "Memories",
  subtitle,
}: {
  memberId?: string;
  eventId?: string;
  // null suppresses the built-in header (when the caller renders its own).
  title?: string | null;
  subtitle?: string;
}) {
  // Cached per-entity fetch; local `posts` mirrors it so optimistic ❤️ toggles
  // stay snappy. Reseeded whenever the cached data changes.
  const { posts: fetched } = useMemories(memberId, eventId);
  const [posts, setPosts] = useState<Post[]>([]);
  const [open, setOpen] = useState<Post | null>(null);
  const { isSignedIn } = useAuth();

  // Toggle ❤️ — optimistic, synced to both the grid and the open lightbox.
  async function react(postId: string) {
    const flip = (p: Post): Post =>
      p.id === postId ? { ...p, reacted: !p.reacted, reactions: (p.reactions ?? 0) + (p.reacted ? -1 : 1) } : p;
    setPosts((ps) => ps.map(flip));
    setOpen((o) => (o ? flip(o) : o));
    try {
      const res = await fetch(`/api/posts/${postId}/react`, { method: "POST" });
      const d = await res.json();
      if (res.ok) {
        const sync = (p: Post): Post => (p.id === postId ? { ...p, reacted: d.reacted, reactions: d.count } : p);
        setPosts((ps) => ps.map(sync));
        setOpen((o) => (o ? sync(o) : o));
      }
    } catch {
      /* keep optimistic state */
    }
  }

  useEffect(() => {
    setPosts(fetched);
  }, [fetched]);

  // Flatten every post's media into individual square tiles.
  const tiles: Tile[] = posts.flatMap((post) => [
    ...post.image_urls.map((url) => ({ post, url, kind: "image" as const })),
    ...post.video_urls.map((url) => ({ post, url, kind: "video" as const })),
  ]);

  if (tiles.length === 0) return null;

  const contributors = new Set(posts.map((p) => p.author_name || p.author_id)).size;

  return (
    <section>
      <div className={"mb-3 flex items-baseline justify-between gap-3" + (title === null ? " hidden" : "")}>
        <p className="section-label flex items-center gap-1.5">
          <Images className="h-3.5 w-3.5" /> {title}
        </p>
        <span className="text-xs text-stone-400">
          {subtitle ??
            `${tiles.length} ${tiles.length === 1 ? "post" : "posts"} from ${contributors} ${
              contributors === 1 ? "person" : "people"
            }`}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-1 sm:gap-1.5">
        {tiles.map((t, i) => (
          <button
            key={`${t.url}-${i}`}
            onClick={() => setOpen(t.post)}
            className="group relative aspect-square overflow-hidden rounded-md bg-stone-100"
          >
            {t.kind === "video" ? (
              // YouTube-hosted videos show their poster thumbnail (a raw <video>
              // can't play a watch URL); legacy Supabase videos still use <video>.
              youtubeThumb(t.url) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={youtubeThumb(t.url)!} alt="" className="h-full w-full object-cover transition group-hover:scale-105" />
              ) : (
                <video src={t.url} muted playsInline className="h-full w-full object-cover" />
              )
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={t.url} alt="" className="h-full w-full object-cover transition group-hover:scale-105" />
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

      {open && (
        <PostLightbox
          post={open}
          onClose={() => setOpen(null)}
          onReact={() => react(open.id)}
          canReact={!!isSignedIn}
          onModerated={() => {
            // Reported/blocked → drop it from view immediately.
            setPosts((ps) => ps.filter((p) => p.author_id !== open.author_id && p.id !== open.id));
            setOpen(null);
          }}
        />
      )}
    </section>
  );
}

