"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X, Images, Heart } from "lucide-react";
import { useAuth, SignInButton } from "@clerk/nextjs";
import { useMemories } from "@/lib/data-hooks";
import { streamEmbed, youtubeThumb } from "@/lib/embed";
import { PostModerationMenu } from "@/components/posts/PostModerationMenu";
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
        <Lightbox
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

function Lightbox({
  post,
  onClose,
  onReact,
  canReact,
  onModerated,
}: {
  post: Post;
  onClose: () => void;
  onReact: () => void;
  canReact: boolean;
  onModerated: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const when = (() => {
    try {
      return new Date(post.created_at).toLocaleDateString([], {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return "";
    }
  })();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-stone-900">
              {post.author_name || "Someone"}
            </p>
            {when && <p className="text-xs text-stone-400">{when}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <PostModerationMenu post={post} onDone={onModerated} />
            <button onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-stone-400 hover:bg-stone-100">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="space-y-2 p-2">
          {post.image_urls.map((url) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={url} src={url} alt="" className="w-full rounded-lg object-contain" />
          ))}
          {post.video_urls.map((url) => {
            // YouTube-hosted → embed iframe; legacy Supabase video → <video>.
            const embed = streamEmbed(url);
            return embed ? (
              <div key={url} className="aspect-video w-full overflow-hidden rounded-lg bg-black">
                <iframe
                  src={embed.src}
                  title="Video"
                  className="h-full w-full"
                  allow="autoplay; fullscreen; encrypted-media"
                  allowFullScreen
                />
              </div>
            ) : (
              <video key={url} src={url} controls playsInline className="w-full rounded-lg" />
            );
          })}
        </div>

        {/* ❤️ react — the first return trigger */}
        <div className="flex items-center gap-2 px-4 pt-1">
          {canReact ? (
            <button
              onClick={onReact}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-600 transition hover:text-rose-500"
            >
              <Heart className={`h-5 w-5 ${post.reacted ? "fill-rose-500 text-rose-500" : "text-stone-400"}`} />
              {post.reactions ?? 0}
            </button>
          ) : (
            <SignInButton mode="modal">
              <button className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-rose-500">
                <Heart className="h-5 w-5 text-stone-400" /> {post.reactions ?? 0}
              </button>
            </SignInButton>
          )}
        </div>

        {(post.body || post.tagged_member_id || post.tagged_event_id) && (
          <div className="space-y-2 px-4 pb-4">
            {post.body && <p className="text-sm leading-relaxed text-stone-700">{post.body}</p>}
            <div className="flex flex-wrap gap-2">
              {post.tagged_member_id && post.tagged_member_name && (
                <Link
                  href={`/members/${post.tagged_member_id}`}
                  className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
                >
                  📍 {post.tagged_member_name}
                </Link>
              )}
              {post.tagged_event_id && post.tagged_event_title && (
                <Link
                  href={`/events/${post.tagged_event_id}`}
                  className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100"
                >
                  🎟 {post.tagged_event_title}
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
