// Turning a row into a map pin.
//
// One adapter per surface, both producing the same `MapPoint`, so the split
// view and the mobile sheet never learn what they are drawing.
//
// The emoji answers "what KIND of thing is this" in one glyph, which is the
// only thing short enough to sit inside a 32px pin. Both readers fall through
// to a neutral marker rather than guessing: a wrong icon is worse than no icon,
// because it gets read as a fact.

import type { Member } from "@/lib/types";
import type { MapPoint } from "@/components/home/split-types";

const has = (s: string, ...words: string[]) => words.some((w) => s.includes(w));

/** What kind of place a business is. Read off the same fields the browse
 *  groups match on, so a pin and the rail a business appears in can't
 *  disagree. */
export function memberEmoji(m: Member): string {
  const p = m.profile ?? {};
  const s = [p.category, p.subcategory, p.businessCategory, p.businessType, p.memberType]
    .filter((v): v is string => typeof v === "string")
    .join(" ")
    .toLowerCase();

  if (has(s, "coffee", "cafe", "café")) return "☕";
  if (has(s, "bakery", "baker", "pastry", "dessert")) return "🥐";
  if (has(s, "bar", "brewery", "pub", "cocktail", "wine")) return "🍸";
  if (has(s, "food", "restaurant", "kitchen", "eatery", "taco", "dining")) return "🍽️";
  if (has(s, "grocery", "market")) return "🛒";
  if (has(s, "book")) return "📚";
  if (has(s, "flower", "florist")) return "💐";
  if (has(s, "retail", "shop", "store", "boutique", "apparel", "clothing", "fashion")) return "🛍️";
  if (has(s, "art", "gallery", "ceramic", "craft", "handmade", "paint")) return "🎨";
  if (has(s, "music", "band", "dj", "concert", "record")) return "🎵";
  if (has(s, "theater", "theatre", "dance", "comedy", "film", "performance")) return "🎭";
  if (has(s, "wellness", "yoga", "spa", "massage", "health")) return "🧘";
  if (has(s, "fitness", "gym")) return "🏋️";
  if (has(s, "salon", "barber", "hair", "beauty", "nail")) return "💈";
  if (has(s, "community", "nonprofit", "cause", "civic")) return "🤝";
  return "📍";
}

/** Null when the business has no position — the caller drops it from the map
 *  but keeps it in the list, which is the right way round: a place we can't
 *  place is still a place you can read about. */
export function memberPoint(m: Member): MapPoint | null {
  const p = m.profile ?? {};
  if (typeof p.latitude !== "number" || typeof p.longitude !== "number") return null;
  return {
    id: m.id,
    lat: p.latitude,
    lng: p.longitude,
    emoji: memberEmoji(m),
    title: p.name || "Place",
  };
}

/** What kind of event this is, from its title and theme. */
export function eventEmojiFor(text: string): string {
  const s = text.toLowerCase();
  if (has(s, "market", "flea", "bazaar", "pop-up", "popup")) return "🛍️";
  if (has(s, "music", "concert", "band", "dj", "live set", "jazz")) return "🎵";
  if (has(s, "food", "dinner", "brunch", "tasting", "supper", "restaurant")) return "🍽️";
  if (has(s, "art", "gallery", "exhibit", "mural", "craft")) return "🎨";
  if (has(s, "comedy", "improv", "standup", "stand-up")) return "🎤";
  if (has(s, "film", "movie", "screening", "cinema")) return "🎬";
  if (has(s, "book", "reading", "poetry", "author", "literary")) return "📚";
  if (has(s, "yoga", "meditat", "wellness", "breathwork")) return "🧘";
  if (has(s, "run", "race", "hike", "fitness", "workout", "bike")) return "🏃";
  if (has(s, "kids", "family", "storytime", "children")) return "🧸";
  if (has(s, "workshop", "class", "talk", "panel", "lecture")) return "🎓";
  if (has(s, "party", "dance", "club", "nightlife")) return "🪩";
  if (has(s, "volunteer", "clean", "community", "meeting", "town hall")) return "🤝";
  return "📅";
}
