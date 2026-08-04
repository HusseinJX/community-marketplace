// ─────────────────────────────────────────────────────────────────────────────
// PROTOTYPE mock data — UI-only. No DB, no cron, no network. Throwaway.
// Powers /prototype/feed, /prototype/host, /prototype/admin so we can SEE the
// vision (aggregated local feed + venue booking + sourcing dashboard) before
// building anything real.
// ─────────────────────────────────────────────────────────────────────────────

export type SourceKind = "instagram" | "calendar" | "eventbrite" | "library" | "newsletter";

export const SOURCE_META: Record<SourceKind, { label: string; emoji: string; tint: string }> = {
  instagram: { label: "Instagram", emoji: "📷", tint: "bg-fuchsia-100 text-fuchsia-700" },
  calendar: { label: "City calendar", emoji: "🏛️", tint: "bg-sky-100 text-sky-700" },
  eventbrite: { label: "Eventbrite", emoji: "🎟️", tint: "bg-orange-100 text-orange-700" },
  library: { label: "Library", emoji: "📚", tint: "bg-emerald-100 text-emerald-700" },
  newsletter: { label: "Newsletter", emoji: "✉️", tint: "bg-violet-100 text-violet-700" },
};

// A neighborhood-dense feed: events (RSVP-able) + announcements (lightweight).
export type FeedItem = {
  id: string;
  kind: "event" | "announcement";
  title: string;
  where: string;
  when: string;
  blurb?: string;
  gradient: string; // css gradient for the cover — no external images in the prototype
  emoji: string;
  source: { via: string; kind: SourceKind };
  rsvps?: number;
  cap?: number;
  tag?: string;
};

export const FEED: FeedItem[] = [
  {
    id: "f1", kind: "event", title: "Sunset Rooftop Salsa",
    where: "El Techo, Mission", when: "Tonight · 8:00 PM",
    blurb: "Free beginner lesson at 8, open dancing till late. Bring a friend.",
    gradient: "linear-gradient(135deg,#f97316,#db2777)", emoji: "💃",
    source: { via: "@eltechosf", kind: "instagram" }, rsvps: 34, cap: 60, tag: "Nightlife",
  },
  {
    id: "f2", kind: "announcement", title: "Free produce — Saturday 10am",
    where: "Mission Food Hub, 24th St", when: "Sat · 10:00 AM",
    blurb: "Weekly community distribution. No ID, no cost. Volunteers welcome.",
    gradient: "linear-gradient(135deg,#10b981,#0ea5e9)", emoji: "🥬",
    source: { via: "SF Marin Food Bank", kind: "newsletter" }, tag: "Mutual aid",
  },
  {
    id: "f3", kind: "event", title: "Neighborhood Print-Making Workshop",
    where: "SF Public Library, Mission Branch", when: "Sun · 2:00 PM",
    blurb: "Hands-on linocut session. Materials provided, all ages.",
    gradient: "linear-gradient(135deg,#6366f1,#a855f7)", emoji: "🖨️",
    source: { via: "SFPL Events", kind: "library" }, rsvps: 12, cap: 20, tag: "Workshop",
  },
  {
    id: "f4", kind: "announcement", title: "Showing the Champions League final ⚽",
    where: "Kilowatt Bar, 16th St", when: "Wed · 12:00 PM",
    blurb: "Big screen, full sound, brunch menu. Rooting for the underdogs.",
    gradient: "linear-gradient(135deg,#0ea5e9,#22c55e)", emoji: "📺",
    source: { via: "@kilowattbar", kind: "instagram" }, tag: "Watch party",
  },
  {
    id: "f5", kind: "event", title: "Dolores Park Cleanup + Coffee",
    where: "Dolores Park", when: "Sat · 9:00 AM",
    blurb: "One hour of pickup, free coffee after. Gloves & bags provided.",
    gradient: "linear-gradient(135deg,#22c55e,#84cc16)", emoji: "🧤",
    source: { via: "SF Rec & Parks", kind: "calendar" }, rsvps: 41, cap: 80, tag: "Volunteer",
  },
  {
    id: "f6", kind: "event", title: "Local Makers Night Market",
    where: "The Chapel, Valencia St", when: "Fri · 6:00 PM",
    blurb: "20 local vendors, live music, food trucks. Free entry.",
    gradient: "linear-gradient(135deg,#f59e0b,#ef4444)", emoji: "🛍️",
    source: { via: "Eventbrite", kind: "eventbrite" }, rsvps: 87, cap: 150, tag: "Market",
  },
  {
    id: "f7", kind: "announcement", title: "New mural unveiling on Balmy Alley",
    where: "Balmy Alley, Mission", when: "Thu · 5:00 PM",
    blurb: "Community celebration for the new piece by local artists.",
    gradient: "linear-gradient(135deg,#ec4899,#8b5cf6)", emoji: "🎨",
    source: { via: "@precitaeyes", kind: "instagram" }, tag: "Arts",
  },
];

// ── Host / venue booking ─────────────────────────────────────────────────────
export type Venue = {
  id: string;
  name: string;
  kind: string;
  gradient: string;
  emoji: string;
  minCap: number;
  maxCap: number;
  costPerEvent: number;
  neighborhood: string;
  perks: string[];
  openSlots: { id: string; day: string; date: string; time: string }[];
};

export const VENUES: Venue[] = [
  {
    id: "v1", name: "Kilowatt Bar — Back Room", kind: "Bar · sports & events",
    gradient: "linear-gradient(135deg,#0f172a,#1d4ed8)", emoji: "🍺",
    minCap: 8, maxCap: 40, costPerEvent: 120, neighborhood: "Mission",
    perks: ["Projector + sound", "Full bar", "Street-level entry"],
    openSlots: [
      { id: "s1", day: "Tue", date: "May 6", time: "7:00–10:00 PM" },
      { id: "s2", day: "Wed", date: "May 7", time: "6:00–9:00 PM" },
      { id: "s3", day: "Sun", date: "May 11", time: "2:00–5:00 PM" },
    ],
  },
  {
    id: "v2", name: "The Chapel — Mezzanine", kind: "Music venue",
    gradient: "linear-gradient(135deg,#7c2d12,#f59e0b)", emoji: "🎶",
    minCap: 20, maxCap: 120, costPerEvent: 400, neighborhood: "Valencia",
    perks: ["Stage + PA", "Green room", "Bar staff included"],
    openSlots: [
      { id: "s4", day: "Thu", date: "May 8", time: "8:00–11:00 PM" },
      { id: "s5", day: "Mon", date: "May 12", time: "6:00–9:00 PM" },
    ],
  },
  {
    id: "v3", name: "Reveille Coffee — Loft", kind: "Café · daytime",
    gradient: "linear-gradient(135deg,#78350f,#fbbf24)", emoji: "☕",
    minCap: 5, maxCap: 18, costPerEvent: 60, neighborhood: "Jackson Sq",
    perks: ["Wifi + screen", "Coffee catering", "Quiet mornings"],
    openSlots: [
      { id: "s6", day: "Wed", date: "May 7", time: "9:00–11:00 AM" },
      { id: "s7", day: "Fri", date: "May 9", time: "8:00–10:00 AM" },
      { id: "s8", day: "Sat", date: "May 10", time: "3:00–5:00 PM" },
    ],
  },
];

// ── Create: proactive AI event ideas (personalized to you + local spots) ─────
export const YOUR_INTERESTS = ["salsa", "board games", "coffee", "live music", "running"];

export type EventIdea = {
  id: string;
  title: string;
  emoji: string;
  gradient: string;
  theme: string;
  whyForYou: string;      // the personalization reason
  venueId: string | null; // matched local spot (null = outdoor / bring-your-own)
  venueNote?: string;
  suggestedWhen: string;
  crowd: string;
  recurring?: boolean;
  description: string;    // AI-drafted blurb
  prep: string[];
  hostSteps: string[];
};

export const EVENT_IDEAS: EventIdea[] = [
  {
    id: "idea-salsa",
    title: "Rooftop Salsa Social",
    emoji: "💃", gradient: "linear-gradient(135deg,#f97316,#db2777)",
    theme: "Beginner-friendly dance night",
    whyForYou: "You saved 3 salsa nights this month — nobody's hosting one on the east side.",
    venueId: "v1", suggestedWhen: "Tuesdays, 8:00 PM", crowd: "15–40",
    recurring: true,
    description:
      "A welcoming salsa social: a free 30-minute beginner lesson at 8, then open dancing till late. Two-left-feet encouraged. Great first-timer energy, no partner needed.",
    prep: [
      "Book Kilowatt's back room (Tue 7pm slot is open)",
      "Line up an instructor for the 8pm intro lesson",
      "Build a 2-hour salsa/bachata playlist or book a DJ",
      "Set your RSVP goal at 15 so it's guaranteed lively",
    ],
    hostSteps: [
      "Greet people + check RSVPs at the door",
      "Kick off the beginner lesson at 8 sharp",
      "Open the floor at 8:30, rotate partners",
      "Shout out the bar's drink specials (keeps the venue happy)",
    ],
  },
  {
    id: "idea-boardgames",
    title: "Weekly Board-Game Night",
    emoji: "🎲", gradient: "linear-gradient(135deg,#6366f1,#22d3ee)",
    theme: "Cozy recurring meetup",
    whyForYou: "Board games keep showing up in what you save — this is a habit waiting to happen.",
    venueId: "v3", suggestedWhen: "Wednesdays, 6:30 PM", crowd: "8–18",
    recurring: true,
    description:
      "A low-key weekly game night at a quiet café loft. Bring a game or borrow from the shelf. Perfect for making it a regular thing people count on.",
    prep: [
      "Reserve Reveille's loft (recurring Wed slot)",
      "Ask 2–3 friends to bring their game collections",
      "Post a 'what to bring' note in the event",
      "Set a small $5 RSVP to cover the café minimum",
    ],
    hostSteps: [
      "Lay out games + a sign-up whiteboard",
      "Pair up newcomers so nobody sits out",
      "Announce next week's date before people leave",
      "Collect emails for the regulars' list",
    ],
  },
  {
    id: "idea-run",
    title: "Sunset Run Club + Tacos",
    emoji: "🏃", gradient: "linear-gradient(135deg,#22c55e,#84cc16)",
    theme: "Active + social, outdoors",
    whyForYou: "You RSVP'd to the park cleanup and like running — combine the two.",
    venueId: null, venueNote: "Dolores Park (meet at the top corner) → taqueria after",
    suggestedWhen: "Thursdays, 6:00 PM", crowd: "10–30",
    recurring: true,
    description:
      "An easy 5K social run at golden hour, ending with tacos and agua fresca at a local spot. All paces welcome — the point is the hang, not the pace.",
    prep: [
      "Pick a simple loop + a meetup landmark",
      "Line up a taqueria for the after (ask for a group deal)",
      "Recruit one 'sweeper' so slower runners aren't alone",
      "No venue booking needed — it's outdoor + a walk-in after",
    ],
    hostSteps: [
      "Circle up, quick intros, set the route",
      "Run easy, regroup at the halfway point",
      "Walk to tacos together",
      "Snap a group photo for next week's invite",
    ],
  },
  {
    id: "idea-vinyl",
    title: "Vinyl Listening Party",
    emoji: "🎶", gradient: "linear-gradient(135deg,#7c2d12,#f59e0b)",
    theme: "Live-music lovers",
    whyForYou: "Live music is your #1 interest and no one's doing a listening night nearby.",
    venueId: "v2", suggestedWhen: "One Thursday, 8:00 PM", crowd: "20–60",
    description:
      "A curated album listening party on a real sound system — one classic record, start to finish, then open decks for guests to spin a track. Between-sets mingling encouraged.",
    prep: [
      "Book The Chapel mezzanine",
      "Pick the headline album + a theme",
      "Invite 3 guest selectors to bring a record",
      "Set RSVP at 20 and a $10 ticket",
    ],
    hostSteps: [
      "Open doors + set the vibe with warm-up tracks",
      "Play the headline album uninterrupted",
      "Hand the decks to guest selectors",
      "Thank the venue + tease the next one",
    ],
  },
];

// ── Admin: content sourcing pipeline ─────────────────────────────────────────
// Hierarchy: COUNTRY → CITY → SOURCE. Only the US is live for now.
export type Country = {
  id: string;
  name: string;
  flag: string;
  status: "live" | "planned";
};

export const COUNTRIES: Country[] = [
  { id: "us", name: "United States", flag: "🇺🇸", status: "live" },
  { id: "ca", name: "Canada", flag: "🇨🇦", status: "planned" },
  { id: "mx", name: "Mexico", flag: "🇲🇽", status: "planned" },
  { id: "uk", name: "United Kingdom", flag: "🇬🇧", status: "planned" },
];

// Sources are scoped to a PLACE (city); each city belongs to a country.
export type Place = {
  id: string;
  countryId: string;
  city: string;
  emoji: string;
  status: "live" | "planned";
};

export const PLACES: Place[] = [
  { id: "sf", countryId: "us", city: "San Francisco", emoji: "🌉", status: "live" },
  { id: "oak", countryId: "us", city: "Oakland", emoji: "🌳", status: "planned" },
  { id: "la", countryId: "us", city: "Los Angeles", emoji: "🌴", status: "planned" },
  { id: "nyc", countryId: "us", city: "New York", emoji: "🗽", status: "planned" },
  { id: "chi", countryId: "us", city: "Chicago", emoji: "🌆", status: "planned" },
];

// City centers, so the feed can auto-detect the nearest populated city.
export const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  sf: { lat: 37.7749, lng: -122.4194 },
  oak: { lat: 37.8044, lng: -122.2712 },
  la: { lat: 34.0522, lng: -118.2437 },
  nyc: { lat: 40.7128, lng: -74.006 },
  chi: { lat: 41.8781, lng: -87.6298 },
};

// Approx location per feed item, so the feed can show "how far" from the user.
export const FEED_COORDS: Record<string, { lat: number; lng: number }> = {
  f1: { lat: 37.7566, lng: -122.4188 }, // El Techo, Mission
  f2: { lat: 37.7525, lng: -122.418 }, // Mission Food Hub, 24th St
  f3: { lat: 37.7524, lng: -122.416 }, // SFPL Mission Branch
  f4: { lat: 37.7648, lng: -122.4189 }, // Kilowatt Bar, 16th St
  f5: { lat: 37.7596, lng: -122.4269 }, // Dolores Park
  f6: { lat: 37.7599, lng: -122.4215 }, // The Chapel, Valencia
  f7: { lat: 37.7519, lng: -122.412 }, // Balmy Alley, Mission
};

export function distanceMi(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  return haversineMi(a, b);
}

function haversineMi(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 3958.8; // earth radius, miles
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

// Nearest populated city to a point. `activeOnly` restricts to activated (live)
// cities — used to name the closest city we actually cover right now.
export function nearestPlace(
  lat: number,
  lng: number,
  opts?: { activeOnly?: boolean },
): { place: Place; distanceMi: number } | null {
  const pool = PLACES.filter((p) => CITY_COORDS[p.id] && (!opts?.activeOnly || p.status === "live"));
  let best: { place: Place; distanceMi: number } | null = null;
  for (const p of pool) {
    const d = haversineMi({ lat, lng }, CITY_COORDS[p.id]);
    if (!best || d < best.distanceMi) best = { place: p, distanceMi: d };
  }
  return best;
}

export type Source = {
  id: string;
  placeId: string;
  handle: string;
  kind: SourceKind;
  status: "active" | "paused" | "error";
  lastRun: string;
  nextRun: string;
  pulled: number;
  published: number;
  filtered: number;
  note?: string;
};

export const SOURCES: Source[] = [
  { id: "src1", placeId: "sf", handle: "SF Rec & Parks calendar", kind: "calendar", status: "active", lastRun: "12 min ago", nextRun: "in 48 min", pulled: 23, published: 18, filtered: 5 },
  { id: "src2", placeId: "sf", handle: "@eltechosf", kind: "instagram", status: "active", lastRun: "12 min ago", nextRun: "in 48 min", pulled: 6, published: 4, filtered: 2 },
  { id: "src3", placeId: "sf", handle: "SFPL — Mission Branch", kind: "library", status: "active", lastRun: "1 hr ago", nextRun: "in 5 hrs", pulled: 11, published: 11, filtered: 0 },
  { id: "src4", placeId: "sf", handle: "Eventbrite: SF / Mission", kind: "eventbrite", status: "active", lastRun: "34 min ago", nextRun: "in 26 min", pulled: 40, published: 27, filtered: 13 },
  { id: "src5", placeId: "sf", handle: "@missiondolores", kind: "instagram", status: "error", lastRun: "3 hrs ago", nextRun: "retry queued", pulled: 0, published: 0, filtered: 0, note: "Rate-limited (429) — backing off" },
  { id: "src6", placeId: "sf", handle: "SF Marin Food Bank newsletter", kind: "newsletter", status: "paused", lastRun: "2 days ago", nextRun: "—", pulled: 0, published: 0, filtered: 0 },
];

// A city is a mini-directory: sources (feeds) + resources + people + businesses.
export type DirItem = {
  id: string;
  placeId: string;
  name: string;
  tag: string;
  emoji: string;
  sub?: string;
};

// Resources for residents/people (the resident-facing community hub).
export const RESIDENT_RESOURCES: DirItem[] = [
  { id: "r1", placeId: "sf", name: "Mission Food Hub", tag: "Food", emoji: "🥫", sub: "Free groceries · 24th St" },
  { id: "r2", placeId: "sf", name: "SF Housing Rights Committee", tag: "Housing", emoji: "🏠", sub: "Tenant support" },
  { id: "r3", placeId: "sf", name: "La Raza Community Legal", tag: "Legal aid", emoji: "⚖️", sub: "Immigration clinic" },
  { id: "r4", placeId: "sf", name: "Mission Neighborhood Health", tag: "Health", emoji: "🩺", sub: "Sliding-scale clinic" },
  { id: "r5", placeId: "sf", name: "SF Public Library — Jobs", tag: "Jobs", emoji: "💼", sub: "Résumé & career help" },
];

// Resources for small businesses (the vendor-facing hub).
export const BUSINESS_RESOURCES: DirItem[] = [
  { id: "br1", placeId: "sf", name: "SF Office of Small Business", tag: "Permits", emoji: "🏛️", sub: "Licensing & permits" },
  { id: "br2", placeId: "sf", name: "Renaissance Entrepreneurship", tag: "Mentorship", emoji: "🚀", sub: "Training & coaching" },
  { id: "br3", placeId: "sf", name: "MEDA — Fondo Adelante", tag: "Loans", emoji: "💰", sub: "Small-business lending" },
  { id: "br4", placeId: "sf", name: "SCORE San Francisco", tag: "Advising", emoji: "🧭", sub: "Free mentoring" },
];

// Fetches are per-source now (a source card expands to its recent fetches).
export type Fetch = {
  id: string;
  sourceId: string;
  title: string;
  action: "published" | "deduped" | "held";
  at: string;
  note?: string;
};

export const FETCHES: Fetch[] = [
  // src1 — SF Rec & Parks calendar
  { id: "f-1", sourceId: "src1", title: "Dolores Park Cleanup + Coffee", action: "published", at: "12 min ago" },
  { id: "f-2", sourceId: "src1", title: "Free Yoga at the Panhandle", action: "published", at: "12 min ago" },
  { id: "f-3", sourceId: "src1", title: "Park Cleanup (duplicate listing)", action: "deduped", at: "12 min ago", note: "Same event already sourced from Eventbrite" },
  { id: "f-4", sourceId: "src1", title: "Rec Center closed — maintenance", action: "held", at: "1 hr ago", note: "Not an event/announcement" },
  { id: "f-5", sourceId: "src1", title: "Twilight Concert Series", action: "published", at: "3 hrs ago" },
  // src2 — @eltechosf
  { id: "f-6", sourceId: "src2", title: "Sunset Rooftop Salsa", action: "published", at: "12 min ago" },
  { id: "f-7", sourceId: "src2", title: "20% off bottomless brunch", action: "held", at: "12 min ago", note: "Promotional, not a community event" },
  { id: "f-8", sourceId: "src2", title: "Live mariachi Friday", action: "published", at: "2 hrs ago" },
  // src3 — SFPL Mission Branch
  { id: "f-9", sourceId: "src3", title: "Print-Making Workshop", action: "published", at: "1 hr ago" },
  { id: "f-10", sourceId: "src3", title: "Free legal clinic (immigration)", action: "published", at: "1 hr ago" },
  { id: "f-11", sourceId: "src3", title: "Toddler Story Time", action: "published", at: "1 hr ago" },
  // src4 — Eventbrite SF / Mission
  { id: "f-12", sourceId: "src4", title: "Makers Night Market", action: "deduped", at: "34 min ago", note: "Already posted by the venue" },
  { id: "f-13", sourceId: "src4", title: "$$$ CRYPTO MEETUP — DM to join", action: "held", at: "34 min ago", note: "Spam / off-topic filter" },
  { id: "f-14", sourceId: "src4", title: "Mission Jazz Night", action: "published", at: "34 min ago" },
  { id: "f-15", sourceId: "src4", title: "Startup pitch night (SoMa)", action: "held", at: "34 min ago", note: "Outside the Mission catchment" },
];

export function fetchesForSource(sourceId: string): Fetch[] {
  return FETCHES.filter((f) => f.sourceId === sourceId);
}
