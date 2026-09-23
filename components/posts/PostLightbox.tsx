"use client";

import { useEffect } from "react";
import Link from "next/link";
import { X, Heart } from "lucide-react";
import { useLogin } from "@/components/auth/ClerkAuthProvider";
import { PostModerationMenu } from "@/components/posts/PostModerationMenu";
import { streamEmbed } from "@/lib/embed";
import type { Post } from "@/lib/posts";

// The opened post. Shared by every square grid — the memories wall and the
// business's own behind-the-scenes feed show the same thing when you tap a
// tile, and two copies of this drifted apart the moment one gained a feature.
export function PostLightbox({
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
  const openLogin = useLogin();

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
            <PostModerationMenu
              postId={post.id}
              authorId={post.author_id}
              authorName={post.author_name}
              onDone={onModerated}
            />
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
            <button
              onClick={() => openLogin()}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-rose-500"
            >
              <Heart className="h-5 w-5 text-stone-400" /> {post.reactions ?? 0}
            </button>
          )}
        </div>

        {(post.body || post.tagged_member_id || post.tags?.length || post.tagged_event_id) && (
          <div className="space-y-2 px-4 pb-4">
            {post.body && <p className="text-sm leading-relaxed text-stone-700">{post.body}</p>}
            {post.location && (
              <p className="text-xs text-stone-500">📍 {post.location}</p>
            )}
            <div className="flex flex-wrap gap-2">
              {/* Everyone credited. `tags` holds the full list for a post with
                  several people on it (a mural's artists); a post with only the
                  single legacy column falls back to that, so nothing that
                  predates multi-tagging loses its credit. */}
              {(post.tags?.length
                ? post.tags
                : post.tagged_member_id
                  ? [{ id: post.tagged_member_id, name: post.tagged_member_name }]
                  : []
              ).map((t) => (
                <Link
                  key={t.id}
                  href={`/members/${t.id}`}
                  className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
                >
                  📍 {t.name || "View profile"}
                </Link>
              ))}
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
