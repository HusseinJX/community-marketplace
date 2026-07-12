import Image from "next/image";
import Link from "next/link";
import { ArrowRight, MapPin } from "lucide-react";
import { cityImageUrl, type WorldCupCity } from "@/lib/world-cup-cities";

interface Props {
  city: WorldCupCity;
  size?: "default" | "compact";
}

function stadiumUrl(city: WorldCupCity) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(city.stadium + " " + city.name)}`;
}

export function WorldCupCityCard({ city, size = "default" }: Props) {
  const firstSentence = city.vibe.split(".")[0] + ".";

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-2xl bg-stone-900 transition-shadow hover:shadow-xl hover:ring-1 hover:ring-white/20">
      {/* Full-card link sits behind everything */}
      <Link
        href={`/world-cup/${city.slug}`}
        className="absolute inset-0 z-10"
        aria-label={`Explore ${city.displayName}`}
      />

      {/* Photo */}
      <div className={`relative ${size === "default" ? "h-52" : "h-40"} w-full`}>
        <Image
          src={cityImageUrl(city.imagePath, 800)}
          alt={city.displayName}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 320px"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10" />

        <div className="absolute inset-0 flex flex-col justify-end p-4">
          <div className="flex items-end justify-between gap-2">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xl">{city.flag}</span>
                <p className="text-[11px] font-medium uppercase tracking-widest text-white/60">
                  {city.country} · {city.region}
                </p>
              </div>
              <h3 className="mt-0.5 text-xl font-bold leading-tight text-white drop-shadow-sm">
                {city.displayName}
              </h3>
            </div>
            <ArrowRight className="mb-0.5 h-4 w-4 shrink-0 text-white/50 transition group-hover:translate-x-0.5 group-hover:text-white/90" />
          </div>

          {size === "default" && (
            <p className="mt-2 text-sm leading-relaxed text-white/75 line-clamp-2">
              {firstSentence}
            </p>
          )}
        </div>
      </div>

      {/* Bottom strip — pillars + stadium button */}
      <div className="relative z-20 flex items-center justify-between gap-2 bg-stone-900 px-4 py-3">
        <div className="flex min-w-0 flex-wrap gap-1.5">
          {city.pillars.slice(0, 3).map((p) => (
            <span
              key={p}
              className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-medium text-white/65"
            >
              {p}
            </span>
          ))}
        </div>
        <a
          href={stadiumUrl(city)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white/80 ring-1 ring-white/10 transition hover:bg-white/20 hover:text-white"
        >
          <MapPin className="h-3 w-3" />
          Stadium
        </a>
      </div>
    </div>
  );
}
