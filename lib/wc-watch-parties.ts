// Where to watch the World Cup in SF — a curated highlight of the city's best
// watch-party spots. Evergreen (not tied to specific matches or live-now
// status): fan zones, beer gardens, and big-screen gathering places that go
// all-in for the tournament. Images are free-license placeholders that match
// the vibe — swap in real venue photos/clips (e.g. Gray Line SF). Link a venue
// to a real directory listing with `memberId`.

export interface WatchParty {
  id: string;
  name: string;
  neighborhood: string;
  note: string;
  tags: string[];
  imageUrl: string;
  /** Optional member profile to deep-link to. */
  memberId?: string;
}

export const WC_WATCH_PARTIES: WatchParty[] = [
  {
    id: "thrive-city",
    name: "Thrive City",
    neighborhood: "Mission Bay",
    note: "The outdoor plaza at Chase Center — giant screens and full fan-zone energy on the biggest match days.",
    tags: ["Fan zone", "Outdoor", "Giant screens"],
    imageUrl: "https://images.unsplash.com/photo-1577223625816-7546f13df25d?auto=format&fit=crop&w=1200&q=70",
  },
  {
    id: "chase-center",
    name: "Chase Center",
    neighborhood: "Mission Bay",
    note: "The arena hosts marquee viewing parties on the big board for the tournament's biggest moments.",
    tags: ["Arena", "Big board", "Events"],
    imageUrl: "https://images.unsplash.com/photo-1518604666860-9ed391f76460?auto=format&fit=crop&w=1200&q=70",
  },
  {
    id: "spark-social",
    name: "Spark Social SF",
    neighborhood: "Mission Bay",
    note: "A food-truck park and beer garden with screens and a backyard vibe — an easy all-day watch spot.",
    tags: ["Food trucks", "Beer garden", "Outdoor"],
    imageUrl: "https://images.unsplash.com/photo-1565123409695-7b5ef63a2efb?auto=format&fit=crop&w=1200&q=70",
  },
  {
    id: "china-basin-park",
    name: "China Basin Park",
    neighborhood: "Mission Rock",
    note: "SF's new waterfront park by the ballpark — open lawns and bay views for a relaxed big-screen watch.",
    tags: ["Waterfront", "Lawn", "Family-friendly"],
    imageUrl: "https://images.unsplash.com/photo-1444723121867-7a241cacace9?auto=format&fit=crop&w=1200&q=70",
  },
  {
    id: "the-crossing-east-cut",
    name: "The Crossing at East Cut",
    neighborhood: "East Cut",
    note: "An outdoor beer garden and event space downtown — communal tables and screens for match day.",
    tags: ["Beer garden", "Outdoor", "Downtown"],
    imageUrl: "https://images.unsplash.com/photo-1538488881038-e252a119ace7?auto=format&fit=crop&w=1200&q=70",
  },
  {
    id: "yerba-buena-lane",
    name: "Yerba Buena Lane",
    neighborhood: "Downtown",
    note: "A pedestrian lane in the heart of downtown — a central gathering spot near the museums and food.",
    tags: ["Pedestrian", "Central", "Downtown"],
    imageUrl: "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?auto=format&fit=crop&w=1200&q=70",
  },
];
