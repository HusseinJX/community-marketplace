// Local petitions / causes — a home for the things people would otherwise only
// hear about from a canvasser on the street. Surfaced in-app so anyone can find
// and sign them on their own time. Demo content for now (no DB): signing is
// optimistic + remembered in localStorage so the UI feels real pre-launch.

export interface Petition {
  id: string;
  title: string;
  /** One-line ask, shown on the card. */
  summary: string;
  /** Longer body for the detail view. */
  description: string;
  /** Who's behind it. */
  org: string;
  /** Optional member id so the org name links to a profile. */
  orgId?: string;
  category: PetitionCategory;
  /** Where it's rooted — a neighborhood, or "near {shop}". */
  location: string;
  goal: number;
  /** Base signature count (demo). Local signs add on top. */
  signatures: number;
  imageUrl?: string;
}

export type PetitionCategory =
  | "Small business"
  | "Housing"
  | "Environment"
  | "Streets & transit"
  | "Schools"
  | "Parks"
  | "Safety";

export const PETITION_CATEGORIES: PetitionCategory[] = [
  "Small business",
  "Housing",
  "Environment",
  "Streets & transit",
  "Schools",
  "Parks",
  "Safety",
];

export const DEMO_PETITIONS: Petition[] = [
  {
    id: "save-corner-market",
    title: "Keep the corner market on Mission open",
    summary: "Stop the rent hike forcing out a 30-year family grocery.",
    description:
      "La Esquina has served the Mission for over 30 years. A sudden rent increase threatens to close it for good. We're asking the city and the landlord to support a fair lease so this neighborhood staple — and the family behind it — can stay. Sign to show the landlord and city how much this shop means to us.",
    org: "Mission Merchants Alliance",
    category: "Small business",
    location: "Near La Esquina Market, Mission",
    goal: 2000,
    signatures: 1432,
    imageUrl:
      "https://images.unsplash.com/photo-1488459716781-31db52582fe9?auto=format&fit=crop&w=1200&q=70",
  },
  {
    id: "protect-small-biz-rent",
    title: "Cap commercial rent hikes for small storefronts",
    summary: "Protect local shops from being priced out of their blocks.",
    description:
      "Small storefronts are the heart of our neighborhoods, but runaway commercial rents are pushing them out one by one. We're petitioning for common-sense protections that give independent shops a fair shot at staying. Your signature tells decision-makers this matters to residents, not just business owners.",
    org: "WhatsLocal Community Coalition",
    category: "Small business",
    location: "Citywide",
    goal: 5000,
    signatures: 3187,
    imageUrl:
      "https://images.unsplash.com/photo-1521017432531-fbd92d768814?auto=format&fit=crop&w=1200&q=70",
  },
  {
    id: "tenant-protections",
    title: "Stronger protections for renters facing eviction",
    summary: "Give families more time and legal help before eviction.",
    description:
      "Too many neighbors are losing their homes with little notice and no legal support. We're asking for stronger renter protections: more notice, access to free counsel, and mediation before eviction. Sign to stand with renters in our community.",
    org: "Bay Tenants Together",
    category: "Housing",
    location: "Citywide",
    goal: 4000,
    signatures: 2611,
    imageUrl:
      "https://images.unsplash.com/photo-1460317442991-0ec209397118?auto=format&fit=crop&w=1200&q=70",
  },
  {
    id: "safer-bike-lanes",
    title: "Protected bike lanes on Valencia Street",
    summary: "Make the corridor safe for bikes, walkers, and shops.",
    description:
      "Valencia is one of our busiest corridors for people on bikes and on foot, but it isn't safe enough. We're petitioning for fully protected bike lanes and safer crossings that also help local businesses by bringing more foot traffic. Sign to back a safer street.",
    org: "Streets for People SF",
    category: "Streets & transit",
    location: "Valencia St, Mission",
    goal: 3000,
    signatures: 1890,
    imageUrl:
      "https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=1200&q=70",
  },
  {
    id: "clean-green-dolores",
    title: "More trees and cleaner streets in our neighborhood",
    summary: "Fund tree planting and weekly street cleaning.",
    description:
      "Greener, cleaner streets make our blocks healthier and our shops more inviting. We're asking the city to fund neighborhood tree planting and regular street cleaning. Sign to bring more shade, less litter, and a bit more life to the sidewalk.",
    org: "Green Blocks Collective",
    category: "Environment",
    location: "Dolores & 18th",
    goal: 1500,
    signatures: 742,
    imageUrl:
      "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1200&q=70",
  },
  {
    id: "fund-after-school",
    title: "Save after-school programs at Bryant Elementary",
    summary: "Keep free after-school care for working families.",
    description:
      "After-school programs keep kids safe and learning while parents work — but budget cuts put them at risk. We're petitioning to protect funding so every family that needs it keeps access. Sign to stand up for local kids and parents.",
    org: "Bryant Family Council",
    category: "Schools",
    location: "Near Bryant Elementary",
    goal: 1200,
    signatures: 968,
    imageUrl:
      "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=1200&q=70",
  },
];

export function getDemoPetition(id: string): Petition | undefined {
  return DEMO_PETITIONS.find((p) => p.id === id);
}

export function pct(signatures: number, goal: number): number {
  if (goal <= 0) return 0;
  return Math.min(100, Math.round((signatures / goal) * 100));
}
