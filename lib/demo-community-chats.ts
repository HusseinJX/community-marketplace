// Community chats — a group chat rooted to a physical place.
//
// The mechanic, and the reason this isn't just "a chat feature": a room is not
// listed anywhere. You find it by being near it. It surfaces in your feed only
// when you're inside its *discovery* radius, and you can only walk in when
// you're inside the (much tighter) *join* radius. Leave, and it goes quiet
// again — unless you starred it, in which case it lives on your profile.
//
// So the room belongs to the corner it's on, not to a directory. Stumbling on
// one is the whole point.
//
// UI-only for now: demo rooms, demo transcripts, stars kept in localStorage
// (lib/community-saves.ts). No table, no API — same staging pattern as
// lib/demo-petitions.ts.

import { distanceKm } from "@/lib/native-geo";

// ── OFF while this is UI only ────────────────────────────────────────────────
// The proximity rules below are written and wired, but flipped off so every room
// is visible and enterable from the feed regardless of where you are. Nothing is
// deleted — set this to `true` to get the real behaviour back (feed cards hide
// outside the discovery radius, rooms lock outside the join radius).
//
// Keep every gate reading from this one constant so turning it on is a one-line
// change and can't half-apply.
export const LOCATION_GATING = false;

export interface CommunityChatMessage {
  id: string;
  /** Display name. Demo transcripts are neighbours, not businesses. */
  author: string;
  /** Minutes ago — rendered relative so the demo never looks stale. */
  minsAgo: number;
  body: string;
  /** A joined/left line renders as centred grey text instead of a bubble. */
  system?: boolean;
}

export interface CommunityChat {
  id: string;
  name: string;
  /** One line on the card — what this room is for. */
  blurb: string;
  emoji: string;
  /** Human label for the anchor point ("Dolores Park, Mission"). */
  locationLabel: string;
  lat: number;
  lng: number;
  /** Walk-in radius, metres. Inside this you can open and post. */
  joinRadiusM: number;
  /** Appears in your feed within this many km. Always > joinRadiusM. */
  discoveryRadiusKm: number;
  memberCount: number;
  /** Shown as a live dot on the card. */
  activeNow: number;
  /** Tailwind gradient stops for the card's cover. */
  gradient: string;
  messages: CommunityChatMessage[];
}

export const DEMO_COMMUNITY_CHATS: CommunityChat[] = [
  {
    id: "dolores-park",
    name: "Dolores Park",
    blurb: "Who's on the hill, what's going on, who's got a speaker.",
    emoji: "🌳",
    locationLabel: "Dolores Park, Mission",
    lat: 37.7596,
    lng: -122.4269,
    joinRadiusM: 400,
    discoveryRadiusKm: 5,
    memberCount: 214,
    activeNow: 9,
    gradient: "from-emerald-400 via-teal-400 to-cyan-500",
    messages: [
      { id: "m1", author: "Nia", minsAgo: 52, body: "sunny patch by the tennis courts is wide open if anyone's looking" },
      { id: "m2", author: "Theo", minsAgo: 44, body: "heading over in 20. bringing the speaker, taking requests" },
      { id: "m3", author: "Sam", minsAgo: 31, body: "the churro guy is by the top entrance today not the usual spot" },
      { id: "m4", author: "Priya", minsAgo: 24, system: true, body: "Priya joined" },
      { id: "m5", author: "Priya", minsAgo: 22, body: "first time here! is it always this packed on a saturday" },
      { id: "m6", author: "Nia", minsAgo: 19, body: "this is a quiet one honestly 😅 come find us we're near the palms" },
      { id: "m7", author: "Marcus", minsAgo: 8, body: "anyone lose a grey jacket? left it with the ice cream cart" },
    ],
  },
  {
    id: "mission-makers",
    name: "Mission Makers",
    blurb: "Stall holders and regulars around 24th & Mission.",
    emoji: "🎨",
    locationLabel: "24th & Mission",
    lat: 37.7523,
    lng: -122.4183,
    joinRadiusM: 500,
    discoveryRadiusKm: 5,
    memberCount: 138,
    activeNow: 4,
    gradient: "from-orange-400 via-rose-400 to-fuchsia-500",
    messages: [
      { id: "m1", author: "Rosa", minsAgo: 180, body: "market's on til 6 today, weather held up" },
      { id: "m2", author: "Dee", minsAgo: 96, body: "does anyone have a spare table? mine cracked this morning" },
      { id: "m3", author: "Rosa", minsAgo: 90, body: "I've got one in the van, come grab it" },
      { id: "m4", author: "Kwame", minsAgo: 35, body: "reminder the permit meeting is thursday 7pm at the library, we should all go" },
    ],
  },
  {
    id: "hayes-valley",
    name: "Hayes Valley Evenings",
    blurb: "What's open late, who's playing, where there's a table.",
    emoji: "🌆",
    locationLabel: "Patricia's Green, Hayes Valley",
    lat: 37.7765,
    lng: -122.4262,
    joinRadiusM: 350,
    discoveryRadiusKm: 5,
    memberCount: 96,
    activeNow: 2,
    gradient: "from-violet-500 via-indigo-500 to-sky-500",
    messages: [
      { id: "m1", author: "Elena", minsAgo: 140, body: "live set at the wine bar around 8 if anyone's free" },
      { id: "m2", author: "Jonah", minsAgo: 120, body: "two seats at the bar right now, going fast" },
      { id: "m3", author: "Elena", minsAgo: 45, body: "it's completely full now, try the patio round the corner" },
    ],
  },
  {
    id: "chinatown-mornings",
    name: "Chinatown Mornings",
    blurb: "Early markets, fresh trays, who's queueing where.",
    emoji: "🥟",
    locationLabel: "Stockton St, Chinatown",
    lat: 37.7941,
    lng: -122.4078,
    joinRadiusM: 400,
    discoveryRadiusKm: 5,
    memberCount: 172,
    activeNow: 6,
    gradient: "from-amber-400 via-orange-500 to-red-500",
    messages: [
      { id: "m1", author: "Wei", minsAgo: 210, body: "fresh trays just out at the bakery on stockton, get there before 9" },
      { id: "m2", author: "Lin", minsAgo: 165, body: "queue is already round the corner 😩" },
      { id: "m3", author: "Wei", minsAgo: 150, body: "worth it. get the ones with the sesame top" },
      { id: "m4", author: "Auntie Mei", minsAgo: 60, body: "greens are cheap today at the corner stall, best I've seen all month" },
    ],
  },
];

export function getCommunityChat(id: string): CommunityChat | undefined {
  return DEMO_COMMUNITY_CHATS.find((c) => c.id === id);
}

/** Metres between the viewer and a room's anchor. */
export function metresAway(chat: CommunityChat, coords: [number, number]): number {
  return distanceKm(coords[0], coords[1], chat.lat, chat.lng) * 1000;
}

/** Close enough to walk in and post. */
export function canEnter(chat: CommunityChat, coords: [number, number]): boolean {
  return metresAway(chat, coords) <= chat.joinRadiusM;
}

/** Close enough for the room to surface in your feed at all. */
export function isDiscoverable(chat: CommunityChat, coords: [number, number]): boolean {
  return metresAway(chat, coords) <= chat.discoveryRadiusKm * 1000;
}

/** "180 m away" / "1.2 km away" — the distance copy used on cards and gates. */
export function distanceLabel(metres: number): string {
  if (metres < 1000) return `${Math.round(metres / 10) * 10} m away`;
  return `${(metres / 1000).toFixed(1)} km away`;
}
