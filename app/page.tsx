import type { Metadata } from "next";
import { HomeTabs } from "@/components/home/HomeTabs";

export const metadata: Metadata = {
  title: "WhatsLocal — what's on & who's local near you",
  description:
    "Everything local in one place: live now at venues, events happening now and coming up, and the local directory of businesses, makers, and community orgs near you.",
  alternates: { canonical: "/" },
};

// The single shopper home: an Airbnb-style selector switches between Feed
// (live venues + community posts), Events, and Shop (the local directory).
// Always render fresh — feeds are fetched client-side.
export const dynamic = "force-dynamic";

export default function HomePage() {
  return <HomeTabs />;
}
