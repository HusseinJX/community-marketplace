"use client";

import Link from "next/link";
import { MapPin, PlayCircle } from "lucide-react";
import { eventEmoji, eventLabel, timeLeftLabel } from "@/lib/live-events";
import { SaveButton } from "./SaveButton";
import type { LiveBroadcast } from "./types";

export function BroadcastCard({ b }: { b: LiveBroadcast }) {
  const place = [b.neighborhood, b.city].filter(Boolean).join(", ");
  const cover = b.image_urls?.[0];
  return (
    <div className="card-soft card-hover flex h-full flex-col overflow-hidden">
      {/* Clickable header → live-event page */}
      <Link href={`/live/${b.id}`} className="block">
        {cover ? (
          <div className="relative h-36 w-full overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cover} alt={b.whats_on || "live"} className="h-full w-full object-cover" />
            <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
              <LiveDot light /> Live
            </span>
            {b.livestream_url && (
              <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white">
                <PlayCircle className="h-3 w-3" /> Stream
              </span>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 px-4 pt-4">
            <span className="text-2xl leading-none">{eventEmoji(b.event_slug)}</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-700">
              <LiveDot /> Live
            </span>
          </div>
        )}
        <div className="px-4 pt-3">
          <span className="truncate text-xs font-medium text-stone-500">
            {eventLabel(b.event_slug, b.event_label)}
          </span>
          <p className="truncate text-base font-semibold text-stone-900 hover:text-rose-700">
            {b.whats_on || eventLabel(b.event_slug, b.event_label)}
          </p>
        </div>
      </Link>

      <div className="flex flex-1 flex-col gap-2 px-4 pb-4 pt-2">
        <Link href={`/members/${b.member_id}`} className="text-sm font-medium text-indigo-600 hover:text-indigo-800">
          {b.member_name || "View venue"}
        </Link>

        {b.supports_team && (
          <span className="inline-flex w-fit items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
            🏳️ Rooting for {b.supports_team}
          </span>
        )}

        {b.note && <p className="text-sm text-stone-600">{b.note}</p>}

        <div className="mt-auto flex items-center justify-between pt-1">
          <div className="flex items-center gap-3 text-xs text-stone-500">
            {place && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" /> {place}
              </span>
            )}
            <span className="font-medium text-rose-600">{timeLeftLabel(b.ends_at)}</span>
          </div>
          <SaveButton broadcastId={b.id} initialSaved={b.saved} initialCount={b.save_count} />
        </div>
      </div>
    </div>
  );
}

function LiveDot({ light }: { light?: boolean }) {
  return (
    <span className="relative flex h-1.5 w-1.5">
      <span className={"absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 " + (light ? "bg-white" : "bg-rose-500")} />
      <span className={"relative inline-flex h-1.5 w-1.5 rounded-full " + (light ? "bg-white" : "bg-rose-600")} />
    </span>
  );
}
