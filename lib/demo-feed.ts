export type FeedAuthor = {
  id: string;
  name: string;
  type: "vendor" | "artist" | "organizer" | "shopper" | "influencer";
};

export type FeedItemBase = {
  id: string;
  author: FeedAuthor;
  postedAt: string;
  postedAtOrder: number;
};

export type EventFeedItem = FeedItemBase & {
  kind: "event";
  eventId: string; // links to /events/[id]
  title: string;
  date: string;
  location: string;
  description: string;
  images?: string[];
  /** Watched calendar this was harvested from, else undefined for community
      events. Its "author" is a source, not a member — so the card must not
      link the byline to /members/{id}, which would 404. */
  sourceId?: string | null;
  /** Canonical page on the source site, for harvested events. */
  eventUrl?: string | null;
};

export type VendorPostFeedItem = FeedItemBase & {
  kind: "post";
  body: string;
  images?: string[];
  product?: { id: string; name: string; price: number; memberId: string; memberName: string };
};

// A real community "share" post (from the share composer / posts table). Unlike
// VendorPostFeedItem, its author is a Clerk user (not a member), so it carries
// its own tagged-entity links instead of linking the author to /members.
export type SharePostFeedItem = FeedItemBase & {
  kind: "share";
  postId: string;
  // Real Clerk author id (for moderation block); absent on demo posts.
  authorId?: string | null;
  body: string;
  images?: string[];
  videos?: string[];
  taggedMember?: { id: string; name: string } | null;
  taggedEvent?: { id: string; title: string } | null;
  location?: string | null;
  /** Miles from the reader, when both ends are known. Null = unplaceable. */
  miles?: number | null;
  livestreamUrl?: string | null;
  reactions?: number;
  reacted?: boolean;
};

export type FeedItem = EventFeedItem | VendorPostFeedItem | SharePostFeedItem;

const xeno: FeedAuthor = {
  id: "89516919-256f-4a95-96df-fc9d285f664a",
  name: "Xeno",
  type: "vendor",
};
const dani: FeedAuthor = { id: "demo-dani-cruz", name: "Dani Cruz", type: "artist" };
const southLA: FeedAuthor = {
  id: "demo-south-la-mutual-aid",
  name: "South LA Mutual Aid",
  type: "organizer",
};
const casaVerde: FeedAuthor = {
  id: "demo-casa-verde",
  name: "Casa Verde Plant Co",
  type: "organizer",
};

export const DEMO_FEED: FeedItem[] = [
  {
    id: "f1",
    kind: "post",
    author: xeno,
    postedAt: "3 hours ago",
    postedAtOrder: 1,
    body: "Building WhatsLocal so every neighborhood has its own internet — where the corner shop, the muralist, and the block party all show up in one place. If you run something local in SF, come claim your profile.",
    images: [
      "https://images.unsplash.com/photo-1521747116042-5a810fda9664?auto=format&fit=crop&w=1200&q=70",
    ],
  },
  {
    id: "f2",
    kind: "event",
    eventId: "demo-e4",
    author: southLA,
    postedAt: "1 day ago",
    postedAtOrder: 2,
    title: "Spring Community Swap Meet",
    date: "Saturday, May 17 · 10am – 4pm",
    location: "Leimert Park Village, Los Angeles",
    description:
      "Join us for our quarterly swap meet — local vendors, live music, free entry. Bring items to trade or just come browse.",
    images: [
      "https://images.unsplash.com/photo-1533900298318-6b8da08a523e?auto=format&fit=crop&w=1200&q=70",
      "https://images.unsplash.com/photo-1506157786151-b8491531f063?auto=format&fit=crop&w=1200&q=70",
      "https://images.unsplash.com/photo-1464983953574-0892a716854b?auto=format&fit=crop&w=1200&q=70",
    ],
  },
  {
    id: "f3",
    kind: "post",
    author: dani,
    postedAt: "2 days ago",
    postedAtOrder: 3,
    body: "Just finished this new mural in Boyle Heights. Commission slots open for summer — reach out if your storefront needs some color.",
    images: [
      "https://images.unsplash.com/photo-1551913902-c92207136625?auto=format&fit=crop&w=1200&q=70",
      "https://images.unsplash.com/photo-1578926375605-eaf7559b1458?auto=format&fit=crop&w=1200&q=70",
    ],
  },
  {
    id: "f4",
    kind: "event",
    eventId: "demo-e2",
    author: xeno,
    postedAt: "3 days ago",
    postedAtOrder: 4,
    title: "WhatsLocal SF Meetup — Founders & Makers",
    date: "Thursday, Jun 19 · 6pm – 8pm",
    location: "SoMa · San Francisco",
    description:
      "Casual meetup for local founders, makers, and small-business owners. Swap ideas, find collaborators, and see what we're building next on WhatsLocal.",
    images: [
      "https://images.unsplash.com/photo-1501594907352-04cda38ebc29?auto=format&fit=crop&w=1200&q=70",
      "https://images.unsplash.com/photo-1522199755839-a2bacb67c546?auto=format&fit=crop&w=1200&q=70",
    ],
  },
  {
    id: "f5",
    kind: "post",
    author: southLA,
    postedAt: "5 days ago",
    postedAtOrder: 5,
    body: "We hit our goal! Thanks to everyone who donated supplies last weekend. Over 240 grocery bags went out to neighbors across South LA.",
    images: [
      "https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&w=1200&q=70",
      "https://images.unsplash.com/photo-1593113598332-cd288d649433?auto=format&fit=crop&w=1200&q=70",
    ],
  },
  {
    id: "f6",
    kind: "event",
    eventId: "demo-e5",
    author: casaVerde,
    postedAt: "1 week ago",
    postedAtOrder: 6,
    title: "Propagation Sunday — Bring a Cutting",
    date: "Sunday, May 25 · 11am – 2pm",
    location: "Highland Park · Casa Verde shop",
    description:
      "Open-house propagation workshop. Bring a cutting, leave with a new plant. Free, all skill levels welcome.",
    images: [
      "https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?auto=format&fit=crop&w=1200&q=70",
      "https://images.unsplash.com/photo-1459411552884-841db9b3cc2a?auto=format&fit=crop&w=1200&q=70",
    ],
  },
];

const TYPE_COLORS: Record<FeedAuthor["type"], string> = {
  vendor: "#3B82F6",
  artist: "#8B5CF6",
  organizer: "#10B981",
  shopper: "#F97316",
  influencer: "#EC4899",
};

export function authorColor(t: FeedAuthor["type"]) {
  return TYPE_COLORS[t];
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}
