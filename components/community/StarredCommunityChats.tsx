"use client";

// Starred rooms on the profile page.
//
// This is the only place a community chat is ever *listed*. Everywhere else it
// has to be stumbled into, so without this a room you loved is gone the moment
// you walk away from it. Self-hides when you haven't starred anything — an
// empty "your rooms" block would advertise a feature you can't go and find.

import Link from "next/link";
import { MapPin, Star } from "lucide-react";
import { useStarredChats } from "@/lib/community-saves";
import {
  DEMO_COMMUNITY_CHATS,
  LOCATION_GATING,
  canEnter,
  distanceLabel,
  metresAway,
} from "@/lib/demo-community-chats";
import { useViewerPosition } from "@/lib/use-viewer-position";

export function StarredCommunityChats() {
  const { starredIds } = useStarredChats();
  const pos = useViewerPosition();

  const chats = DEMO_COMMUNITY_CHATS.filter((c) => starredIds.includes(c.id));
  if (!chats.length) return null;

  return (
    <div className="space-y-3">
      <p className="section-label mb-1">Your community chats</p>

      {chats.map((chat) => {
        const away = LOCATION_GATING && pos.status === "ready" ? metresAway(chat, pos.coords) : null;
        const open = LOCATION_GATING ? pos.status === "ready" && canEnter(chat, pos.coords) : true;

        const inner = (
          <>
            <span className="flex min-w-0 items-center gap-3">
              <span
                className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-lg ${chat.gradient}`}
              >
                {chat.emoji}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-stone-900">{chat.name}</span>
                {/* Distance only when it's why you can't get in — otherwise the
                    "Open now" badge already says everything, and the two
                    together overflow into it on a narrow phone. */}
                <span className="flex items-center gap-1 truncate text-xs text-stone-500">
                  <MapPin className="h-3 w-3 shrink-0" />
                  <span className="truncate">
                    {chat.locationLabel}
                    {away !== null && !open && ` · ${distanceLabel(away)}`}
                  </span>
                </span>
              </span>
            </span>

            {/* The status IS the affordance — a starred room is either open to
                you right now or it isn't, and only distance changes that. With
                gating off every room is open, so the badge says nothing worth
                the space and is dropped rather than always reading "Open now". */}
            {LOCATION_GATING && (
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                  open ? "bg-emerald-50 text-emerald-700" : "bg-stone-100 text-stone-500"
                }`}
              >
                {open ? "Open now" : "Too far"}
              </span>
            )}
          </>
        );

        return open ? (
          <Link
            key={chat.id}
            href={`/community/${chat.id}`}
            className="card-soft card-hover flex items-center justify-between gap-3 p-4"
          >
            {inner}
          </Link>
        ) : (
          <div key={chat.id} className="card-soft flex items-center justify-between gap-3 p-4 opacity-75">
            {inner}
          </div>
        );
      })}

      <p className="flex items-center gap-1.5 px-1 text-[11px] text-stone-400">
        <Star className="h-3 w-3" />
        {LOCATION_GATING
          ? "Starred rooms stay here. You still need to be nearby to open one."
          : "Rooms you starred from the feed."}
      </p>
    </div>
  );
}
