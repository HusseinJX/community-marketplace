import type { Metadata } from "next";
import { WhatsOn } from "@/components/home/WhatsOn";

// A window onto the WhatsOn surface, which nothing else currently renders.
// It is the unified time-ordered stream — Happening now → Today → This weekend
// → Upcoming — with one filter row and one map, live venue broadcasts and
// events as cards in the same list.
//
// noindex: this is the same content as the home Events tab, so letting it be
// crawled would put a duplicate of the feed in the index under a second URL.
export const metadata: Metadata = {
  title: "What's on",
  robots: { index: false, follow: false },
};

export default function WhatsOnPage() {
  return (
    <div className="pb-24">
      <WhatsOn />
    </div>
  );
}
