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

  const hasMedia =
    (item.images && item.images.length > 0) || (item.videos && item.videos.length > 0);

  return (
    <article className="overflow-hidden rounded-2xl border border-stone-200/80 bg-white">
      {/* Author */}
      <div className="flex items-center gap-2.5 px-3.5 pb-2.5 pt-3">
        <span
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
          style={{ backgroundColor: color }}
        >
          {initials(item.author.name)}
        </span>
        <div className="min-w-0 leading-tight">
          <p className="truncate text-sm font-semibold text-stone-900">{item.author.name}</p>
          <p className="text-[11px] text-stone-400">{item.postedAt}</p>
        </div>
      </div>

      {item.body && (
        <p className="whitespace-pre-line px-3.5 pb-3 text-[15px] leading-snug text-stone-800">
          {item.body}
        </p>
      )}

      {/* Media — full-bleed for an app-native feel */}
      {item.images && item.images.length > 0 && (
        <ImageCarousel images={item.images} alt="" aspect="video" rounded="rounded-none" />
      )}

      {item.videos && item.videos.length > 0 && (
        <div className="space-y-px">
          {item.videos.map((url) => (
            <video key={url} src={url} controls playsInline className="w-full bg-black" />
          ))}
        </div>
      )}

      <div className={`px-3.5 pb-3 ${hasMedia ? "pt-3" : ""}`}>
        {/* Tagged entities — the same tags that place this on a memories wall. */}
        {(item.taggedMember || item.taggedEvent || item.location) && (
          <div className="flex flex-wrap gap-1.5">
            {item.taggedMember && (
              <Link
                href={`/members/${item.taggedMember.id}`}
                className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700 hover:bg-indigo-100"
              >
                <Store className="h-3 w-3" /> {item.taggedMember.name}
              </Link>
            )}
            {item.taggedEvent && (
              <Link
                href={`/events/${item.taggedEvent.id}`}
                className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-700 hover:bg-rose-100"
              >
                <CalendarDays className="h-3 w-3" /> {item.taggedEvent.title}
              </Link>
            )}
            {item.location && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                <MapPin className="h-3 w-3" /> {item.location}
              </span>
            )}
          </div>
        )}

        {/* Footer — livestream link + react */}
        <div className="mt-2.5 flex items-center gap-4">
          {isSignedIn ? (
            <button
              onClick={react}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-stone-700 transition hover:text-rose-500"
            >
              <Heart className={`h-[22px] w-[22px] ${reacted ? "fill-rose-500 text-rose-500" : "text-stone-500"}`} />
              {reactions}
            </button>
          ) : (
            <SignInButton mode="modal">
              <button className="inline-flex items-center gap-1.5 text-sm font-semibold text-stone-600 hover:text-rose-500">
                <Heart className="h-[22px] w-[22px] text-stone-500" /> {reactions}
              </button>
            </SignInButton>
          )}
          {item.livestreamUrl && (
            <a
              href={item.livestreamUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm font-semibold text-rose-600 hover:text-rose-800"
            >
              <Radio className="h-4 w-4" /> Watch live
            </a>
          )}
        </div>
      </div>
    </article>
  );
}
