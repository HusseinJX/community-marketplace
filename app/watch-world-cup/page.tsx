import { notFound } from "next/navigation";
import Link from "next/link";
import { Trophy, MapPin } from "lucide-react";
import { WC_WATCH_PARTIES } from "@/lib/wc-watch-parties";
import { FEATURES } from "@/lib/features";

export const metadata = {
  title: "Where to watch the World Cup in SF",
  description:
    "The best World Cup watch parties in San Francisco — fan zones, beer gardens, and big-screen spots going all-in for every match.",
};

export default function WatchWorldCupPage() {
  // Parked for App Store 5.2.1 (branded FIFA/World Cup destination). Restore via
  // lib/features.ts `worldCup`.
  if (!FEATURES.worldCup) notFound();
  return (
    <div className="mx-auto max-w-7xl px-4 pb-24 md:px-8">
      {/* Hero */}
      <section className="relative -mx-4 mb-12 overflow-hidden rounded-b-[2.5rem] md:-mx-8 md:mt-6 md:rounded-[2.5rem]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&w=1600&q=80"
          alt="World Cup watch party"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-stone-950 via-stone-900/70 to-stone-900/30" />
        <div className="relative px-6 py-20 md:py-28">
          <div className="mx-auto max-w-3xl text-center text-white">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-600 px-3 py-1 text-xs font-semibold uppercase tracking-wide">
              <Trophy className="h-3.5 w-3.5" /> FIFA World Cup
            </span>
            <h1 className="mt-4 text-4xl font-semibold leading-[1.05] tracking-tight md:text-6xl">
              Where to watch in SF
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-base text-stone-200 md:text-lg">
              The city&apos;s best watch parties — fan zones, beer gardens, and big-screen spots
              going all-in for every match.
            </p>
          </div>
        </div>
      </section>

      <p className="section-label mb-4">Best watch parties</p>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {WC_WATCH_PARTIES.map((w) => {
          const card = (
            <article className="card-soft group flex h-full flex-col overflow-hidden">
              <div className="relative h-44 w-full overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={w.imageUrl}
                  alt=""
                  className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent" />
                <div className="absolute bottom-3 left-4 right-4 flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-white/85">
                  <MapPin className="h-3.5 w-3.5" /> {w.neighborhood}
                </div>
              </div>
              <div className="flex flex-1 flex-col p-4">
                <h2 className="text-base font-semibold leading-snug text-stone-900">{w.name}</h2>
                <p className="mt-1.5 text-sm text-stone-600">{w.note}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {w.tags.map((t) => (
                    <span key={t} className="rounded-full bg-stone-100 px-2.5 py-0.5 text-[11px] font-medium text-stone-600">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </article>
          );
          return w.memberId ? (
            <Link key={w.id} href={`/members/${w.memberId}`}>
              {card}
            </Link>
          ) : (
            <div key={w.id}>{card}</div>
          );
        })}
      </div>
    </div>
  );
}
