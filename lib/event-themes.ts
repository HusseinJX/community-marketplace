import type { FeedEvent } from "@/app/api/events/feed/route";

// Event "themes" derived from the title/description keywords, since events carry
// no explicit category field. Ordered — the first theme whose keyword matches
// wins, so put the more specific themes higher. Anything unmatched falls into
// the "More events" bucket.
export interface EventTheme {
  key: string;
  label: string;
  emoji: string;
  keywords: string[];
}

export const EVENT_THEMES: EventTheme[] = [
  {
    key: "markets",
    label: "Markets & fairs",
    emoji: "🛍️",
    keywords: ["market", "fair", "bazaar", "flea", "swap", "pop-up", "popup", "vendor", "makers", "craft fair"],
  },
  {
    key: "music",
    label: "Music & nightlife",
    emoji: "🎶",
    keywords: ["music", "dj", "concert", "band", "sound", "party", "nightlife", "rave", "karaoke", "live set", "session"],
  },
  {
    key: "food",
    label: "Food & drink",
    emoji: "🍽️",
    keywords: ["food", "dinner", "brunch", "tasting", "potluck", "bbq", "barbecue", "wine", "beer", "cocktail", "feast", "supper"],
  },
  {
    key: "arts",
    label: "Arts & film",
    emoji: "🎨",
    keywords: ["art", "film", "premiere", "gallery", "mural", "exhibit", "screening", "theater", "theatre", "dance", "poetry", "open mic"],
  },
  {
    key: "learn",
    label: "Workshops & classes",
    emoji: "🛠️",
    keywords: ["workshop", "class", "lesson", "seminar", "talk", "learn", "training", "intro", "bootcamp", "clinic", "panel"],
  },
  {
    key: "community",
    label: "Community & outdoors",
    emoji: "🌳",
    keywords: ["garden", "cleanup", "clean-up", "volunteer", "community", "park", "hike", "outdoor", "meetup", "yoga", "wellness", "block party", "fundraiser"],
  },
];

const FALLBACK: Omit<EventTheme, "keywords"> = { key: "more", label: "More events", emoji: "✨" };

export function themeOf(e: FeedEvent): string {
  const hay = `${e.title} ${e.description}`.toLowerCase();
  for (const t of EVENT_THEMES) {
    if (t.keywords.some((k) => hay.includes(k))) return t.key;
  }
  return FALLBACK.key;
}

export interface ThemedGroup {
  key: string;
  label: string;
  emoji: string;
  items: FeedEvent[];
}

// Group events into themed buckets, preserving EVENT_THEMES order and dropping
// empties. The "More events" catch-all sorts last.
export function groupEventsByTheme(events: FeedEvent[]): ThemedGroup[] {
  const buckets = new Map<string, FeedEvent[]>();
  for (const e of events) {
    const key = themeOf(e);
    (buckets.get(key) ?? buckets.set(key, []).get(key)!).push(e);
  }
  const groups: ThemedGroup[] = [];
  for (const t of EVENT_THEMES) {
    const items = buckets.get(t.key);
    if (items?.length) groups.push({ key: t.key, label: t.label, emoji: t.emoji, items });
  }
  const more = buckets.get(FALLBACK.key);
  if (more?.length) groups.push({ ...FALLBACK, items: more });
  return groups;
}
