import type { Metadata } from "next";
import { LiveFeed } from "@/components/live/LiveFeed";
import { CommunityEventsLive } from "@/components/live/CommunityEventsLive";

export const metadata: Metadata = {
  title: "Live Now — What's on right now",
  description:
    "Find where the game is showing near you — the World Cup, NBA, UFC and more. Live broadcasts from local venues, plus local events happening now and coming up.",
  alternates: { canonical: "/" },
};

// Index = the Live tab. Always render fresh — the feed is fetched client-side
// from /api/broadcasts. Local browse lives at /browse.
export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <LiveFeed
      afterHero={<CommunityEventsLive only="now" />}
      afterFeed={<CommunityEventsLive only="upcoming" />}
    />
  );
}
