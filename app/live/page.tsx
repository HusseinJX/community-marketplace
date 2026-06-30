import type { Metadata } from "next";
import { LiveFeed } from "@/components/live/LiveFeed";
import { CommunityEventsLive } from "@/components/live/CommunityEventsLive";

export const metadata: Metadata = {
  title: "Live Now — What's on right now",
  description:
    "Find where the game is showing near you — the World Cup, NBA, UFC and more. Live broadcasts from local venues with the vibe, the crowd, and the big screen.",
  alternates: { canonical: "/live" },
};

// Always render fresh — the live feed is fetched client-side from /api/broadcasts.
export const dynamic = "force-dynamic";

export default function LivePage() {
  return (
    <>
      <LiveFeed />
      <CommunityEventsLive />
    </>
  );
}
