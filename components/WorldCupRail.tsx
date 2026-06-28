import Link from "next/link";
import { ArrowRight, Trophy } from "lucide-react";
import { WORLD_CUP_CITIES } from "@/lib/world-cup-cities";
import { WorldCupCityCard } from "./WorldCupCityCard";

export function WorldCupRail() {
  return (
    <section className="mb-8">
      <div className="mb-3 flex items-end justify-between gap-3">
        <Link href="/world-cup" className="group min-w-0">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-stone-900">
            <Trophy className="h-5 w-5 text-teal-600" />
            <span className="group-hover:text-teal-700">
              World Cup 2026 · Featured Places
            </span>
          </h2>
          <p className="mt-0.5 truncate text-sm text-stone-500">
            Go for the game. Stay for the place.
          </p>
        </Link>
        <Link
          href="/world-cup"
          className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-teal-700 ring-1 ring-teal-200 transition hover:ring-teal-400"
        >
          All {WORLD_CUP_CITIES.length} cities <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 md:-mx-8 md:px-8 [scrollbar-width:thin]">
        {WORLD_CUP_CITIES.map((city) => (
          <div key={city.slug} className="w-[19rem] shrink-0 snap-start">
            <WorldCupCityCard city={city} />
          </div>
        ))}
      </div>
    </section>
  );
}
