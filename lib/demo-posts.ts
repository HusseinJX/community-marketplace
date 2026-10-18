import type { Post } from "@/lib/posts";

// Fake community posts so the feed board has something to lay out locally.
//
// DEMO MODE ONLY — GET /api/posts appends these when NEXT_PUBLIC_DEMO_MODE=1,
// which prod pins to 0, so no App Store user ever sees them. They are never
// written to the `posts` table.
//
// No tagged_member_id: a tag links to /members/<id>, and an invented id would
// 404. The location label carries the "where" instead. Timestamps are relative
// to now so the feed always reads as recent.

const img = (id: string) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1200&q=70`;

type Seed = {
  author: string;
  body: string;
  photos: string[];
  location: string;
  lat: number;
  lng: number;
  hoursAgo: number;
};

const SEEDS: Seed[] = [
  { author: "Maya R.", body: "Pour-over flight at the new spot on Valencia. The Ethiopian one tastes like blueberries, not joking.", photos: ["1442512595331-e89e73853f31"], location: "Mission District", lat: 37.7599, lng: -122.4214, hoursAgo: 2 },
  { author: "Theo Park", body: "Ferry Building on a Saturday morning is a whole sport. Got the last flat of strawberries 🍓", photos: ["1488459716781-31db52582fe9", "1533900298318-6b8da08a523e"], location: "Ferry Building", lat: 37.7955, lng: -122.3937, hoursAgo: 5 },
  { author: "Jules", body: "Fog rolled out right on cue.", photos: ["1521747116042-5a810fda9664"], location: "Marshall's Beach", lat: 37.8014, lng: -122.4797, hoursAgo: 8 },
  { author: "Sam Okafor", body: "Saturday group ride, 42 miles and one very steep Twin Peaks. Join us next week — everyone's welcome, no-drop pace.", photos: ["1517649763962-0c623066013b"], location: "Twin Peaks", lat: 37.7544, lng: -122.4477, hoursAgo: 11 },
  { author: "Lena", body: "Coffee date that turned into three hours. This place gets it.", photos: ["1495474472287-4d71bcdd2085"], location: "Hayes Valley", lat: 37.7765, lng: -122.4241, hoursAgo: 14 },
  { author: "Outer Sunset Mutual Aid", body: "Huge thanks to the 30+ neighbours who showed up to pack grocery boxes today. 180 families fed this week.", photos: ["1593113598332-cd288d649433", "1532629345422-7515f3d16bb6"], location: "Outer Sunset", lat: 37.7535, lng: -122.4945, hoursAgo: 20 },
  { author: "Dev", body: "Thursday open mic, bring your instrument. The piano is actually in tune now.", photos: ["1571974599782-87624638275e"], location: "Lower Haight", lat: 37.7717, lng: -122.4313, hoursAgo: 26 },
  { author: "Rosa M.", body: "Opening night of the new show — go before it closes on the 20th.", photos: ["1518998053901-5348d3961a04", "1561214115-f2f134cc4912"], location: "Dogpatch", lat: 37.7609, lng: -122.3884, hoursAgo: 31 },
  { author: "Kai", body: "Wood-fired, blistered, perfect. Line was 20 min and worth it.", photos: ["1565299624946-b28f40a0ae38"], location: "North Beach", lat: 37.8061, lng: -122.4103, hoursAgo: 38 },
  { author: "Priya", body: "The taco truck is back on 24th st!! Tuesdays and Fridays from 5.", photos: ["1565123409695-7b5ef63a2efb"], location: "Mission District", lat: 37.7527, lng: -122.4141, hoursAgo: 44 },
  { author: "Noah B.", body: "Kickboxing class at the gym on Folsom absolutely destroyed me. 10/10, will be back Thursday.", photos: ["1517438322307-e67111335449"], location: "SoMa", lat: 37.7749, lng: -122.4108, hoursAgo: 52 },
  { author: "Alex Chen", body: "Muir Woods before the crowds. 7am is the move.", photos: ["1441974231531-c6227db76b6e"], location: "Mill Valley", lat: 37.8970, lng: -122.5811, hoursAgo: 60 },
  { author: "Bea", body: "Free sunrise yoga in Dolores Park every Sunday at 8. Bring a mat, bring a friend.", photos: ["1540206276207-3af25c08abc4"], location: "Dolores Park", lat: 37.7596, lng: -122.4269, hoursAgo: 70 },
  { author: "Marco", body: "Best happy hour in the Marina, fight me. $6 drafts until 7.", photos: ["1543007630-9710e4a00a20"], location: "Marina", lat: 37.8003, lng: -122.4368, hoursAgo: 78 },
  { author: "Hana", body: "Seedling swap at the community garden this weekend — tomatoes, peppers, basil. Bring some, take some.", photos: ["1466692476868-aef1dfb1e735"], location: "Bernal Heights", lat: 37.7411, lng: -122.4156, hoursAgo: 90 },
  { author: "Chris L.", body: "That last song. That confetti. I'm still not over it.", photos: ["1492684223066-81342ee5ff30", "1506157786151-b8491531f063"], location: "The Fillmore", lat: 37.7840, lng: -122.4330, hoursAgo: 100 },
  { author: "Ines", body: "Sidewalk tables are out again. Croissants sell out by 10.", photos: ["1559925393-8be0ec4767c8"], location: "Cole Valley", lat: 37.7658, lng: -122.4500, hoursAgo: 115 },
  { author: "Jordan", body: "Neighbourhood taproom finally has the pumpkin ale on.", photos: ["1538488881038-e252a119ace7"], location: "Inner Richmond", lat: 37.7802, lng: -122.4645, hoursAgo: 130 },
  { author: "Wen", body: "Kids' art morning at the library was pure chaos in the best way.", photos: ["1488521787991-ed7bbaae773c"], location: "Chinatown", lat: 37.7941, lng: -122.4078, hoursAgo: 150 },
  { author: "Tomás", body: "Worked from here all afternoon. Good wifi, better pastries.", photos: ["1521017432531-fbd92d768814"], location: "Inner Sunset", lat: 37.7637, lng: -122.4687, hoursAgo: 170 },
  { author: "Elle", body: "Walked the bridge with visitors from out of town. Never gets old.", photos: ["1501594907352-04cda38ebc29", "1521464302861-ce943915d1c3"], location: "Presidio", lat: 37.8078, lng: -122.4750, hoursAgo: 200 },
];

/** The demo posts, newest first, with timestamps relative to `now`. */
export function getDemoPosts(now = Date.now()): Post[] {
  return SEEDS.map((s, i) => ({
    id: `demo-post-${i + 1}`,
    author_id: `demo-author-${i + 1}`,
    author_name: s.author,
    body: s.body,
    image_urls: s.photos.map(img),
    video_urls: [],
    tagged_member_id: null,
    tagged_member_name: null,
    tagged_event_id: null,
    tagged_event_title: null,
    livestream_url: null,
    location: s.location,
    lat: s.lat,
    lng: s.lng,
    created_at: new Date(now - s.hoursAgo * 3_600_000).toISOString(),
    reactions: 3 + ((i * 7) % 40),
    reacted: false,
  }));
}
