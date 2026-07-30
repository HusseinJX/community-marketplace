"use client";

import { notFound } from "next/navigation";
import { Heart, MessageCircle, Send, Music2, Play } from "lucide-react";
import { FEATURES } from "@/lib/features";

// UI-only shorts/reels feed. No data, no playback — a vertical snap-scroll of
// placeholder cards so the tab has something to show. Wire real media later.
const SHORTS = [
  {
    id: "1",
    handle: "@lunasf",
    caption: "Fresh sourdough out of the oven 🥖 every morning at 7",
    likes: "1.2k",
    comments: "84",
    sound: "original audio · Luna Bakery",
    tint: "from-amber-400 via-orange-500 to-rose-500",
  },
  {
    id: "2",
    handle: "@missionrecords",
    caption: "Crate digging Sundays. New arrivals just dropped 🎧",
    likes: "932",
    comments: "51",
    sound: "Feels Like Summer · vinyl rip",
    tint: "from-violet-500 via-fuchsia-500 to-pink-500",
  },
  {
    id: "3",
    handle: "@dolorespark_yoga",
    caption: "Golden-hour flow in the park. Free class Saturdays 🧘",
    likes: "2.4k",
    comments: "173",
    sound: "Ambient Sunrise · calm beats",
    tint: "from-emerald-400 via-teal-500 to-cyan-500",
  },
  {
    id: "4",
    handle: "@tacoscarmen",
    caption: "Al pastor on the trompo 🌮🔥 corner of 24th & Mission",
    likes: "5.1k",
    comments: "412",
    sound: "Cumbia del Barrio · street mix",
    tint: "from-red-500 via-rose-600 to-amber-500",
  },
];

export default function ShortsPage() {
  // Parked with the nav entry (lib/features.ts `shorts`). The reels feed has no
  // real playback yet — Apple 2.1(a) flagged "the video section did not play," so
  // the whole surface 404s until it ships, not just the nav tab.
  if (!FEATURES.shorts) notFound();

  return (
    <div
      className="fixed left-0 right-0 z-20 bg-black"
      style={{
        top: "calc(env(safe-area-inset-top) + 3.5rem)",
        bottom: "calc(3.25rem + env(safe-area-inset-bottom))",
      }}
    >
      <div className="h-full w-full snap-y snap-mandatory overflow-y-scroll">
        {SHORTS.map((s) => (
          <section
            key={s.id}
            className="relative flex h-full w-full snap-start snap-always items-center justify-center"
          >
            {/* Placeholder "video" surface */}
            <div className={`absolute inset-0 bg-gradient-to-br ${s.tint}`} />
            <div className="absolute inset-0 bg-black/10" />
            <button
              aria-label="Play"
              className="relative z-10 flex h-16 w-16 items-center justify-center rounded-full bg-white/20 backdrop-blur transition active:scale-95"
            >
              <Play className="h-7 w-7 fill-white text-white" />
            </button>

            {/* Right action rail */}
            <div className="absolute bottom-20 right-3 z-10 flex flex-col items-center gap-5 text-white">
              <button className="flex flex-col items-center gap-1">
                <Heart className="h-8 w-8" />
                <span className="text-xs font-semibold">{s.likes}</span>
              </button>
              <button className="flex flex-col items-center gap-1">
                <MessageCircle className="h-8 w-8" />
                <span className="text-xs font-semibold">{s.comments}</span>
              </button>
              <button className="flex flex-col items-center gap-1">
                <Send className="h-7 w-7" />
                <span className="text-xs font-semibold">Share</span>
              </button>
            </div>

            {/* Bottom caption */}
            <div className="absolute inset-x-0 bottom-6 z-10 px-4 pr-16 text-white">
              <p className="text-base font-semibold drop-shadow">{s.handle}</p>
              <p className="mt-1 text-sm leading-snug drop-shadow">{s.caption}</p>
              <p className="mt-2 flex items-center gap-1.5 text-xs opacity-90">
                <Music2 className="h-3.5 w-3.5" /> {s.sound}
              </p>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
