"use client";

// The way you find a community chat: it appears in your feed, unannounced,
// because you happen to be near it.
//
// Two tiers, both deliberate:
//   · outside the discovery radius → the card isn't rendered at all. Rooms
//     elsewhere in the city simply don't exist for you.
//   · inside discovery but outside the join radius → shown, locked, with the
//     distance. Seeing a room you can't quite enter is what teaches the rule.
//
// While the fix is resolving we render nothing rather than a skeleton — a
// placeholder that resolves into "no room here" is worse than the room quietly
// appearing a beat later.

import Link from "next/link";
import { Star, MapPin, Lock } from "lucide-react";
import { useStarredChats } from "@/lib/community-saves";
import {
  type CommunityChat,
  LOCATION_GATING,
  canEnter,
  distanceLabel,
  isDiscoverable,
  metresAway,
} from "@/lib/demo-community-chats";
import { useViewerPosition } from "@/lib/use-viewer-position";

export function CommunityChatCard({ chat }: { chat: CommunityChat }) {
  const pos = useViewerPosition();
  const { isStarred, toggle } = useStarredChats();

  // Gating off: every room shows, open, and we never wait on a position fix.
  if (LOCATION_GATING && pos.status === "locating") return null;

  // No location permission: show the room locked rather than hiding it, so the
  // feature is still discoverable — just not enterable.
  const known = pos.status === "ready";
  if (LOCATION_GATING && known && !isDiscoverable(chat, pos.coords)) return null;

  const away = LOCATION_GATING && known ? metresAway(chat, pos.coords) : null;
  const open = LOCATION_GATING ? known && canEnter(chat, pos.coords) : true;
  const starred = isStarred(chat.id);

  const body = (
    <>
      {/* Cover */}
      <div className={`relative h-28 bg-gradient-to-br ${chat.gradient}`}>
        <span className="absolute left-4 top-4 text-3xl drop-shadow-sm">{chat.emoji}</span>

        {/* Star sits on the cover so it's reachable without opening the room —
            you can keep a place you can't get into yet. */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            toggle(chat.id);
          }}
          aria-pressed={starred}
          aria-label={starred ? `Unstar ${chat.name}` : `Star ${chat.name}`}
          className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/25 text-white backdrop-blur-sm transition hover:bg-black/40"
        >
          <Star className={`h-4.5 w-4.5 ${starred ? "fill-amber-300 text-amber-300" : ""}`} />
        </button>

        {open && (
          <span className="absolute bottom-3 left-4 inline-flex items-center gap-1.5 rounded-full bg-black/30 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-300" />
            </span>
            {chat.activeNow} here now
          </span>
        )}
      </div>

      <div className="p-4">
        <p className="section-label mb-1.5">Community chat</p>
        <h3 className="text-base font-semibold leading-snug text-stone-900">{chat.name}</h3>
        <p className="mt-1 text-sm leading-relaxed text-stone-600">{chat.blurb}</p>

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-500">
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" />
            {chat.locationLabel}
          </span>
          <span>{chat.memberCount} neighbours</span>
          {/* Distance only matters while it's the thing keeping you out — once
              you're inside the radius the line below already says "You're here". */}
          {away !== null && !open && <span>{distanceLabel(away)}</span>}
        </div>

        {open ? (
          <p className="mt-3 text-sm font-semibold text-emerald-700">
            {LOCATION_GATING ? "You're here — tap to join the room →" : "Join the room →"}
          </p>
        ) : (
          <p className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-stone-400">
            <Lock className="h-3.5 w-3.5" />
            {known ? "Get closer to join" : "Turn on location to join"}
          </p>
        )}
      </div>
    </>
  );

  // A locked room is a card, not a link — there's nothing to open yet.
  return open ? (
    <Link
      href={`/community/${chat.id}`}
      className="card-soft card-hover block overflow-hidden"
    >
      {body}
    </Link>
  ) : (
    <div className="card-soft overflow-hidden opacity-90">{body}</div>
  );
}
