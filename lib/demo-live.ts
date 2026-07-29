import type { LiveBroadcast } from "@/components/live/types";
import { FEATURES } from "@/lib/features";

// Demo "Live Now" content so the home screen + /live look alive before any real
// broadcasts exist (mirrors how DEMO_MEMBERS seeds the directory). The venue ids
// match sports-bar entries in lib/demo-members.ts, so every card links to a real
// demo profile. Times are computed relative to now so countdowns stay fresh and
// isLive() is always true.

export interface DemoFeaturedList {
  id: string;
  title: string;
  subtitle: string | null;
  event_slug: string | null;
  supports_team: string | null;
  broadcasts: LiveBroadcast[];
  venues: { member_id: string; name: string; neighborhood: string | null; city: string | null }[];
}

interface DemoSpec {
  member_id: string;
  member_name: string;
  event_slug: string;
  whats_on: string;
  note?: string;
  supports_team?: string;
  neighborhood: string;
  latitude: number;
  longitude: number;
  endsInMin: number;
  save_count: number;
  image_urls?: string[];
  livestream_url?: string | null;
}

function build(spec: DemoSpec, now: number): LiveBroadcast {
  return {
    id: `demo-bc-${spec.member_id}-${spec.event_slug}`,
    member_id: spec.member_id,
    member_name: spec.member_name,
    event_slug: spec.event_slug,
    event_label: null,
    whats_on: spec.whats_on,
    note: spec.note ?? null,
    supports_team: spec.supports_team ?? null,
    image_urls: spec.image_urls ?? [],
    livestream_url: spec.livestream_url ?? null,
    starts_at: new Date(now - 30 * 60_000).toISOString(),
    ends_at: new Date(now + spec.endsInMin * 60_000).toISOString(),
    latitude: spec.latitude,
    longitude: spec.longitude,
    neighborhood: spec.neighborhood,
    city: "Los Angeles",
    active: true,
    save_count: spec.save_count,
    saved: false,
  };
}

const WORLD_CUP: DemoSpec[] = [
  {
    member_id: "demo-el-tri-cantina",
    member_name: "El Tri Cantina",
    event_slug: "world-cup",
    whats_on: "Mexico vs Argentina",
    note: "Micheladas + tacos al pastor, whole place in green",
    supports_team: "Mexico",
    neighborhood: "Boyle Heights",
    latitude: 34.0444,
    longitude: -118.2007,
    endsInMin: 95,
    save_count: 67,
    image_urls: [
      "https://images.unsplash.com/photo-1543007630-9710e4a00a20?w=900&q=80",
      "https://images.unsplash.com/photo-1551038247-3d9af20df552?w=900&q=80",
    ],
  },
  {
    member_id: "demo-azteca-grill",
    member_name: "Azteca Grill & Bar",
    event_slug: "world-cup",
    whats_on: "Mexico vs Argentina",
    note: "Match-day parrillada specials",
    supports_team: "Mexico",
    neighborhood: "East LA",
    latitude: 34.0224,
    longitude: -118.1745,
    endsInMin: 95,
    save_count: 31,
  },
  {
    member_id: "demo-courtside-sports-bar",
    member_name: "Courtside Sports Bar",
    event_slug: "world-cup",
    whats_on: "Mexico vs Argentina",
    note: "Neutral house — every side welcome",
    supports_team: "Argentina",
    neighborhood: "Downtown LA",
    latitude: 34.0481,
    longitude: -118.2575,
    endsInMin: 100,
    save_count: 12,
  },
];

// Generic, non-trademarked demo used while the World Cup surfaces are parked
// (Apple 5.2.1). Same venue ids so cards still link to real demo profiles.
const LOCAL_SCENE: DemoSpec[] = [
  {
    member_id: "demo-el-tri-cantina",
    member_name: "El Tri Cantina",
    event_slug: "live-music",
    whats_on: "Live cumbia + micheladas",
    note: "House band on the patio, tacos al pastor all night",
    neighborhood: "Boyle Heights",
    latitude: 34.0444,
    longitude: -118.2007,
    endsInMin: 95,
    save_count: 67,
    image_urls: [
      "https://images.unsplash.com/photo-1543007630-9710e4a00a20?w=900&q=80",
      "https://images.unsplash.com/photo-1551038247-3d9af20df552?w=900&q=80",
    ],
  },
  {
    member_id: "demo-azteca-grill",
    member_name: "Azteca Grill & Bar",
    event_slug: "watch-party",
    whats_on: "Big-screen game night",
    note: "Parrillada specials, every screen on",
    neighborhood: "East LA",
    latitude: 34.0224,
    longitude: -118.1745,
    endsInMin: 95,
    save_count: 31,
  },
  {
    member_id: "demo-courtside-sports-bar",
    member_name: "Courtside Sports Bar",
    event_slug: "watch-party",
    whats_on: "Trivia + happy hour",
    note: "Neutral house — every side welcome",
    neighborhood: "Downtown LA",
    latitude: 34.0481,
    longitude: -118.2575,
    endsInMin: 100,
    save_count: 12,
  },
];

const DEMO_SPECS = FEATURES.worldCup ? WORLD_CUP : LOCAL_SCENE;

export function getDemoBroadcasts(): LiveBroadcast[] {
  const now = Date.now();
  return DEMO_SPECS.map((s) => build(s, now));
}

export function getDemoFeaturedLists(): DemoFeaturedList[] {
  const now = Date.now();
  if (FEATURES.worldCup) {
    return [
      {
        id: "demo-fl-world-cup",
        title: "Where to watch the World Cup near you",
        subtitle: "Find the match — and the bar that backs your team",
        event_slug: "world-cup",
        supports_team: null,
        broadcasts: WORLD_CUP.map((s) => build(s, now)),
        venues: [],
      },
    ];
  }
  return [
    {
      id: "demo-fl-tonight",
      title: "Out tonight near you",
      subtitle: "Live music, game nights and happy hours around the corner",
      event_slug: null,
      supports_team: null,
      broadcasts: LOCAL_SCENE.map((s) => build(s, now)),
      venues: [],
    },
  ];
}
