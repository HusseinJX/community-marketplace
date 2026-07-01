"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { CommunityFeed } from "@/components/feed/CommunityFeed";

function FeedInner() {
  // ?view=events → an events-only page (no tabs, just events).
  const eventsOnly = useSearchParams().get("view") === "events";

  return (
    <main className="mx-auto w-full max-w-[680px] px-4 py-10 sm:px-6">
      <header className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight text-stone-900">
          {eventsOnly ? "Events" : "Community Feed"}
        </h1>
        <p className="mt-1 text-stone-600">
          {eventsOnly
            ? "Upcoming events from local makers, vendors, and organizers."
            : "Events and updates from local makers and vendors."}
        </p>
      </header>

      <CommunityFeed eventsOnly={eventsOnly} />
    </main>
  );
}

export default function FeedPage() {
  return (
    <Suspense>
      <FeedInner />
    </Suspense>
  );
}
