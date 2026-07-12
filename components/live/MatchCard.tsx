"use client";

import Link from "next/link";
import { eventEmoji, eventLabel } from "@/lib/live-events";
import type { LiveBroadcast } from "./types";

export interface MatchGroup {
  key: string;
  title: string;
  event_slug: string;
  event_label: string | null;
  cover?: string;
  teams: string[];
  venues: LiveBroadcast[];
}

// A card for one match/game. The face shows the matchup + how many places are
// showing it; tapping opens the match page (listings + map).
export function MatchCard({ group }: { group: MatchGroup }) {
  const count = group.venues.length;

  return (
    <Link
      href={`/live/match/${encodeURIComponent(group.key)}`}
      className="flex h-full w-full flex-col overflow-hidden rounded-2xl border border-rose-200 bg-gradient-to-br from-rose-50 to-orange-50 text-left transition hover:border-rose-300"
    >
        {group.cover ? (
          <div className="relative aspect-[16/9] w-full overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={group.cover} alt={group.title} className="h-full w-full object-cover" />
            <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
              <LiveDot light /> Live
            </span>
          </div>
        ) : (
          <div className="relative flex aspect-[16/9] w-full items-center justify-center bg-gradient-to-br from-rose-100 to-orange-100">
            <span className="text-4xl leading-none">{eventEmoji(group.event_slug)}</span>
            <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
              <LiveDot light /> Live
            </span>
          </div>
        )}
        <div className="flex flex-1 flex-col gap-1 px-4 pb-4 pt-3">
          <span className="truncate text-xs font-medium text-stone-500">
            {eventLabel(group.event_slug, group.event_label)}
          </span>
          <p className="truncate text-base font-semibold text-stone-900">{group.title}</p>
          {group.teams.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-0.5">
              {group.teams.slice(0, 3).map((t) => (
                <span key={t} className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                  🏳️ {t}
                </span>
              ))}
            </div>
          )}
          <span className="mt-auto inline-flex w-fit items-center gap-1 rounded-full bg-rose-600 px-2.5 py-1 text-xs font-semibold text-white">
            {count} {count === 1 ? "place" : "places"} showing it →
          </span>
        </div>
    </Link>
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
