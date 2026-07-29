"use client";

import { useState } from "react";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Trophy, ArrowRight } from "lucide-react";
import {
  WORLD_CUP_CITIES,
  COUNTRY_LABELS,
  type WorldCupCity,
} from "@/lib/world-cup-cities";
import { FEATURES } from "@/lib/features";
import { WorldCupCityCard } from "@/components/WorldCupCityCard";

// Aerial Beira Rio Stadium photo (Unsplash, verified 200)
const HERO_IMG = "https://images.unsplash.com/photo-1511204579483-e5c2b1d69acd?auto=format&fit=crop&w=1600&q=80";

type Filter = "All" | WorldCupCity["country"];

const FILTERS: Filter[] = ["All", "USA", "Canada", "Mexico"];

const FILTER_COUNT: Record<Filter, number> = {
  All: WORLD_CUP_CITIES.length,
  USA: WORLD_CUP_CITIES.filter((c) => c.country === "USA").length,
  Canada: WORLD_CUP_CITIES.filter((c) => c.country === "Canada").length,
  Mexico: WORLD_CUP_CITIES.filter((c) => c.country === "Mexico").length,
};

export default function WorldCupPage() {
  // Parked for App Store 5.2.1 (branded FIFA/World Cup destination). Restore via
  // lib/features.ts `worldCup`.
  if (!FEATURES.worldCup) notFound();
  const [filter, setFilter] = useState<Filter>("All");

  const cities =
    filter === "All"
      ? WORLD_CUP_CITIES
      : WORLD_CUP_CITIES.filter((c) => c.country === filter);

  return (
    <div className="mx-auto max-w-7xl px-4 pb-24 md:px-8">
      {/* Hero — stadium photo backdrop, WC2026 teal/gold palette */}
      <section className="relative -mx-4 mb-12 overflow-hidden rounded-b-[2.5rem] md:-mx-8 md:mt-6 md:rounded-[2.5rem]">
        {/* Photo */}
        <div className="absolute inset-0">
          <Image
            src={HERO_IMG}
            alt="Soccer stadium aerial view"
            fill
            priority
            sizes="100vw"
            className="object-cover object-center"
          />
        </div>
        {/* WC teal-to-dark overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#003d3b]/80 via-[#00635e]/60 to-[#001a19]/90" />
        {/* Subtle dot grid */}
        <div className="absolute inset-0 opacity-[0.06] [background-image:radial-gradient(circle_at_1px_1px,#fff_1px,transparent_0)] [background-size:22px_22px]" />
        {/* Gold glow top-right */}
        <div className="absolute -right-20 -top-20 h-80 w-80 rounded-full bg-[#d4a017]/20 blur-3xl" />

        <div className="relative px-6 py-16 md:py-28">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-sm font-semibold text-[#4dd9d4] ring-1 ring-[#4dd9d4]/30 backdrop-blur-sm">
              <Trophy className="h-4 w-4" />
              FIFA World Cup 2026 · North America
            </div>
            <h1 className="text-5xl font-bold leading-[1.05] tracking-tight text-white md:text-7xl">
              Featured Places
              <br />
              <span className="bg-gradient-to-r from-[#d4a017] via-[#f0c040] to-[#d4a017] bg-clip-text text-transparent">
                of the World Cup
              </span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-white/70 md:text-lg">
              The World Cup brings the world to 16 cities. Each one has a soul — already there, already alive. The culture is not somewhere far away, not locked in museums. It&apos;s in the block, the kitchen, the sound, the hands, the stories.
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-4 text-sm text-white/40">
              <span>🇺🇸 11 US cities</span>
              <span>·</span>
              <span>🇨🇦 2 Canadian cities</span>
              <span>·</span>
              <span>🇲🇽 3 Mexican cities</span>
            </div>
            <div className="mt-8">
              <Link
                href="/watch-world-cup"
                className="inline-flex items-center gap-2 rounded-full bg-[#d4a017] px-5 py-2.5 text-sm font-semibold text-stone-900 shadow-sm transition hover:bg-[#f0c040]"
              >
                <Trophy className="h-4 w-4" />
                Where to watch in SF
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Manifesto */}
      <section className="mb-10 border-y border-stone-200 py-10 text-center">
        <p className="mx-auto max-w-2xl text-xl font-medium leading-relaxed text-stone-800 md:text-2xl md:leading-relaxed">
          Every place has its own texture. Its own music. Its own food.
          Its own posture. Its own grief. Its own humor. Its own way of surviving.
        </p>
        <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-stone-500">
          Sometimes the soul of a place gets covered — dulled by sameness, priced out, paved over, forgotten. The work is not to manufacture culture. The culture is already there. The work is to listen until it speaks.
        </p>
      </section>

      {/* Country filter */}
      <div className="mb-6 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={
              "inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition " +
              (filter === f
                ? "bg-teal-700 text-white shadow-sm"
                : "bg-white text-stone-600 ring-1 ring-stone-200 hover:ring-teal-400 hover:text-teal-700")
            }
          >
            {f === "All" ? "All cities" : COUNTRY_LABELS[f as WorldCupCity["country"]]}
            <span
              className={
                "rounded-full px-1.5 py-0.5 text-[11px] font-semibold " +
                (filter === f ? "bg-white/20 text-white" : "bg-stone-100 text-stone-500")
              }
            >
              {FILTER_COUNT[f]}
            </span>
          </button>
        ))}
      </div>

      {/* City grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {cities.map((city) => (
          <WorldCupCityCard key={city.slug} city={city} />
        ))}
      </div>

      {/* Bottom CTA */}
      <section className="mt-16 rounded-2xl bg-stone-900 p-8 text-center md:p-12">
        <p className="text-xs font-semibold uppercase tracking-widest text-stone-400">
          Every city has a song
        </p>
        <p className="mt-3 text-xl font-bold text-white md:text-3xl">
          Go for the game. Stay for the place.
        </p>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-stone-400">
          Local vendors, makers, artists, cooks, builders — the living culture that no tourist map shows you.
        </p>
        <Link
          href="/browse"
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#d4a017] px-5 py-2.5 text-sm font-semibold text-stone-900 transition hover:bg-[#f0c040]"
        >
          Browse the directory <ArrowRight className="h-4 w-4" />
        </Link>
      </section>
    </div>
  );
}
