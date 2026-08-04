"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Sparkles, Rows3 } from "lucide-react";
import { CommunityFeed } from "@/components/feed/CommunityFeed";
import { PersonalizedEvents } from "@/components/feed/PersonalizedEvents";

type Mode = "browse" | "foryou";

function FeedInner() {
  const params = useSearchParams();
  // ?view=events → an events-only page (no tabs, just events).
  const eventsOnly = params.get("view") === "events";
  // ?for=you deep-links straight into the personalised feed.
  const [mode, setMode] = useState<Mode>(params.get("for") === "you" ? "foryou" : "browse");

  return (
    <main className="mx-auto w-full max-w-[680px] px-4 py-10 sm:px-6">
      <header className="mb-5">
        <h1 className="text-3xl font-semibold tracking-tight text-stone-900">
          {eventsOnly ? "Events" : "Community Feed"}
        </h1>
        <p className="mt-1 text-stone-600">
          {mode === "foryou"
            ? "Say what you're after — the feed rearranges around it."
            : eventsOnly
              ? "Upcoming events from local makers, vendors, and organizers."
              : "Events and updates from local makers and vendors."}
        </p>
      </header>

      {/* Two ways to read the same events: a chronological feed, or one
          rearranged around what someone says they want. A segmented control
          rather than a link, because it is one surface in two states — nothing
          is navigated away from and nothing is lost by switching back. */}
      <div
        role="tablist"
        aria-label="Feed mode"
        className="mb-5 inline-flex rounded-full border border-stone-200 bg-stone-50 p-0.5"
      >
        {(
          [
            { id: "browse", label: "Browse", Icon: Rows3 },
            { id: "foryou", label: "For you", Icon: Sparkles },
          ] as const
        ).map(({ id, label, Icon }) => (
          <button
            key={id}
            role="tab"
            aria-selected={mode === id}
            onClick={() => setMode(id)}
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition ${
              mode === id
                ? "bg-white text-stone-900 shadow-sm"
                : "text-stone-500 hover:text-stone-800"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {mode === "foryou" ? <PersonalizedEvents /> : <CommunityFeed eventsOnly={eventsOnly} />}
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
