import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { LiveFeed } from "@/components/live/LiveFeed";
import { CommunityEventsLive } from "@/components/live/CommunityEventsLive";
import { LocalDirectory } from "@/components/home/LocalDirectory";
import { HomeSearch } from "@/components/home/HomeSearch";
import { CommunityFeed } from "@/components/feed/CommunityFeed";

export const metadata: Metadata = {
  title: "WhatsLocal — what's on & who's local near you",
  description:
    "Everything local in one place: live now at venues, events happening now and coming up, and the local directory of businesses, makers, and community orgs near you.",
  alternates: { canonical: "/" },
};

// The single shopper home: Live now → Events → Who's local (directory).
// Always render fresh — feeds are fetched client-side.
export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <LiveFeed
      afterHero={
        <>
          <HomeSearch />
          <CommunityEventsLive only="now" />
        </>
      }
      afterFeed={
        <>
          <CommunityEventsLive only="upcoming" />
          <LocalDirectory />
          {/* The community feed (events + vendor posts), folded into home as a
              horizontal rail so the nav needs no Home/Feed switch. Title links
              to the full vertical feed. */}
          <section className="mx-auto max-w-6xl border-t border-stone-100 px-4 pb-24 pt-8 md:px-8">
            <Link
              href="/events"
              className="group mb-5 inline-flex items-center gap-1 text-xl font-semibold tracking-tight text-stone-900 transition hover:text-stone-600"
            >
              From the community
              <ChevronRight className="h-5 w-5 text-stone-400 transition group-hover:translate-x-0.5 group-hover:text-stone-600" />
            </Link>
            <CommunityFeed layout="rail" />
          </section>
        </>
      }
    />
  );
}
