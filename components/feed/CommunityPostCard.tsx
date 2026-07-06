"use client";

import { useState } from "react";
import Link from "next/link";
import { MapPin, Radio, Store, CalendarDays, Heart } from "lucide-react";
import { useAuth, SignInButton } from "@clerk/nextjs";
import type { SharePostFeedItem } from "@/lib/demo-feed";
import { authorColor, initials } from "@/lib/demo-feed";
import { ImageCarousel } from "@/components/ImageCarousel";

// A real community share post in the feed. Same posts also appear on the tagged
// business/event "memories" wall — this is the timeline surface for them.
export function CommunityPostCard({ item }: { item: SharePostFeedItem }) {
  const { isSignedIn } = useAuth();
  const [reactions, setReactions] = useState(item.reactions ?? 0);
  const [reacted, setReacted] = useState(!!item.reacted);
  const color = authorColor(item.author.type);

  async function react() {
    // Optimistic toggle, reconciled with the server count.
    const next = !reacted;
    setReacted(next);
    setReactions((n) => n + (next ? 1 : -1));
    try {
      const res = await fetch(`/api/posts/${item.postId}/react`, { method: "POST" });
      const d = await res.json();
      if (res.ok) {
        setReacted(!!d.reacted);
        setReactions(d.count ?? 0);
      }
    } catch {
      /* keep optimistic state */
    }
  }

  return (
    <article className="relative overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
      <div className="absolute inset-y-0 left-0 w-1 bg-rose-400" />
      <div className="p-5 pl-6 sm:p-6 sm:pl-7">
        {/* Author */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-stone-500">
          <span
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white"
            style={{ backgroundColor: color }}
          >
            {initials(item.author.name)}
          </span>
          <span className="ml-1 text-sm font-medium text-stone-800">{item.author.name}</span>
          <span>·</span>
          <span>{item.postedAt}</span>
        </div>

        {item.body && (
          <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-stone-800">
            {item.body}
          </p>
        )}

        {item.images && item.images.length > 0 && (
          <div className="mt-4">
            <ImageCarousel images={item.images} alt="" aspect="video" rounded="rounded-xl" />
          </div>
        )}

        {item.videos && item.videos.length > 0 && (
          <div className="mt-4 space-y-2">
            {item.videos.map((url) => (
              <video key={url} src={url} controls playsInline className="w-full rounded-xl bg-black" />
            ))}
          </div>
        )}

        {/* Tagged entities — the same tags that place this on a memories wall. */}
        {(item.taggedMember || item.taggedEvent || item.location) && (
          <div className="mt-4 flex flex-wrap gap-2">
            {item.taggedMember && (
              <Link
                href={`/members/${item.taggedMember.id}`}
                className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
              >
                <Store className="h-3 w-3" /> {item.taggedMember.name}
              </Link>
            )}
            {item.taggedEvent && (
              <Link
                href={`/events/${item.taggedEvent.id}`}
                className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100"
              >
                <CalendarDays className="h-3 w-3" /> {item.taggedEvent.title}
              </Link>
            )}
            {item.location && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                <MapPin className="h-3 w-3" /> {item.location}
              </span>
            )}
          </div>
        )}

        {/* Footer — livestream link + react */}
        <div className="mt-4 flex items-center gap-4">
          {isSignedIn ? (
            <button
              onClick={react}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-600 transition hover:text-rose-500"
            >
              <Heart className={`h-5 w-5 ${reacted ? "fill-rose-500 text-rose-500" : "text-stone-400"}`} />
              {reactions}
            </button>
          ) : (
            <SignInButton mode="modal">
              <button className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-rose-500">
                <Heart className="h-5 w-5 text-stone-400" /> {reactions}
              </button>
            </SignInButton>
          )}
          {item.livestreamUrl && (
            <a
              href={item.livestreamUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm font-medium text-rose-600 hover:text-rose-800"
            >
              <Radio className="h-4 w-4" /> Watch live
            </a>
          )}
        </div>
      </div>
    </article>
  );
}
