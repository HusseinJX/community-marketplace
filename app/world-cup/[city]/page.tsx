import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, MapPin, Trophy, ArrowRight } from "lucide-react";
import {
  WORLD_CUP_CITIES,
  getCityBySlug,
  cityImageUrl,
  COUNTRY_LABELS,
} from "@/lib/world-cup-cities";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface Props {
  params: Promise<{ city: string }>;
}

export async function generateStaticParams() {
  return WORLD_CUP_CITIES.map((c) => ({ city: c.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { city: slug } = await params;
  const city = getCityBySlug(slug);
  if (!city) return {};
  return {
    title: `${city.displayName} · World Cup 2026 | WhatsLocal AI`,
    description: city.vibe,
  };
}

export default async function CityPage({ params }: Props) {
  const { city: slug } = await params;
  const city = getCityBySlug(slug);
  if (!city) notFound();

  const countryLabel = COUNTRY_LABELS[city.country];
  const siblings = WORLD_CUP_CITIES.filter(
    (c) => c.country === city.country && c.slug !== city.slug
  ).slice(0, 4);

  return (
    <div className="mx-auto max-w-5xl px-4 pb-28 md:px-8">

      {/* Back nav */}
      <div className="py-4 md:py-6">
        <Link
          href="/world-cup"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          World Cup 2026
        </Link>
      </div>

      {/* ── Hero ────────────────────────────────────────────────────── */}
      <section className="relative -mx-4 overflow-hidden rounded-xl md:-mx-8 md:rounded-2xl">
        <div className="relative h-64 w-full md:h-96">
          <Image
            src={cityImageUrl(city.imagePath, 1200)}
            alt={city.displayName}
            fill
            priority
            sizes="(max-width: 768px) 100vw, 768px"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
          <div className="absolute inset-0 flex flex-col justify-end px-6 py-7 md:px-10 md:py-10">
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-white/50">
              {city.flag} {countryLabel} · {city.region}
            </p>
            <h1 className="text-3xl font-bold leading-tight text-white md:text-5xl">
              {city.displayName}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-white/60">
              <span className="flex items-center gap-1"><Trophy className="h-3 w-3" /> FIFA World Cup 2026</span>
              <span>·</span>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(city.stadium + " " + city.name)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 hover:text-white/90"
              >
                <MapPin className="h-3 w-3" /> {city.stadium} ↗
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── Vibe ────────────────────────────────────────────────────── */}
      <section className="mt-10 border-t border-border pt-8">
        <p className="text-lg leading-relaxed text-foreground md:text-xl">{city.vibe}</p>
        <p className="mt-4 text-xs font-medium uppercase tracking-widest text-muted-foreground">
          {city.pillars.join(" · ")}
        </p>
      </section>

      {/* ── The Story + images ──────────────────────────────────────── */}
      {city.narrative && (
        <section className="mt-14">
          <p className="mb-6 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            The Story
          </p>
          <div className="space-y-12">
            {city.narrative.chapters.map((ch, i) => (
              <div key={i} className={`flex flex-col gap-6 md:flex-row md:items-start md:gap-10 ${i % 2 === 1 ? "md:flex-row-reverse" : ""}`}>
                {ch.image && (
                  <div className="relative h-52 w-full shrink-0 overflow-hidden rounded-xl md:h-64 md:w-72">
                    <Image src={cityImageUrl(ch.image, 700)} alt={ch.imageAlt ?? ch.title} fill sizes="(max-width: 768px) 100vw, 288px" className="object-cover" />
                  </div>
                )}
                <div className="flex-1">
                  {ch.era && (
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{ch.era}</p>
                  )}
                  <h3 className="mb-2 text-base font-bold text-foreground">{ch.title}</h3>
                  <p className="leading-relaxed text-muted-foreground">{ch.body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── The People ──────────────────────────────────────────────── */}
      {city.narrative && (
        <section className="mt-14">
          <p className="mb-6 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            The People
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {city.narrative.people.map((person) => (
              <div key={person.title} className="rounded-xl border border-border p-5">
                <span className="text-3xl">{person.emoji}</span>
                <p className="mt-3 font-semibold text-foreground">{person.title}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{person.body}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── The Sound ───────────────────────────────────────────────── */}
      {city.narrative && (
        <section className="mt-14">
          <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">The Sound</p>
          <div className="flex flex-wrap gap-2">
            {city.narrative.sounds.map((s) => (
              <span key={s} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground">
                {s}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* ── The Food ────────────────────────────────────────────────── */}
      {city.narrative && (
        <section className="mt-14">
          <p className="mb-6 text-xs font-semibold uppercase tracking-widest text-muted-foreground">The Food</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {city.narrative.foods.map((f) => (
              <div key={f.name} className="rounded-xl border border-border p-5">
                <p className="font-semibold text-foreground">{f.name}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Neighborhoods ───────────────────────────────────────────── */}
      <section className="mt-14">
        <p className="mb-6 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Where the culture lives</p>
        <div className="grid gap-4 sm:grid-cols-2">
          {city.neighborhoods.map((n) => (
            <div key={n.name} className="rounded-xl border border-border p-5">
              <p className="font-semibold text-foreground">{n.name}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{n.note}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Before you arrive ───────────────────────────────────────── */}
      <section className="mt-14 border-t border-border pt-8">
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Before you arrive
        </p>
        <p className="leading-relaxed text-muted-foreground">{city.beforeYouArrive}</p>
      </section>

      {/* ── Upcoming Matches ────────────────────────────────────────── */}
      {city.matches && city.matches.length > 0 && (
        <section className="mt-14">
          <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Matches at {city.stadium}
          </p>
          <div className="divide-y divide-border rounded-xl border border-border">
            {city.matches.map((match) => (
              <div key={`${match.date}-${match.home}-${match.away}`} className="flex items-center gap-4 px-4 py-3.5 text-sm">
                <div className="w-28 shrink-0">
                  <p className="font-medium text-foreground">
                    {new Date(match.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </p>
                  <p className="text-xs text-muted-foreground">{match.time}</p>
                </div>
                <div className="flex flex-1 items-center gap-2">
                  <span>{match.homeFlag}</span>
                  <span className="font-medium text-foreground">{match.home}</span>
                  <span className="text-muted-foreground/40">vs</span>
                  <span>{match.awayFlag}</span>
                  <span className="font-medium text-foreground">{match.away}</span>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">{match.stage}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── CTA ─────────────────────────────────────────────────────── */}
      <Card className="mt-14 bg-foreground text-background">
        <CardContent className="px-8 py-10 text-center md:px-12">
          <p className="text-xs font-semibold uppercase tracking-widest text-white/40">
            The living archive
          </p>
          <p className="mt-3 text-xl font-bold leading-snug text-white md:text-2xl">
            Find the people who carry {city.displayName}&apos;s culture
          </p>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-white/50">
            Vendors, makers, artists, cooks, builders, musicians — the local character that no algorithm can flatten.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="sm" className="rounded-full bg-white text-foreground hover:bg-white/90">
              <Link href={`/?city=${encodeURIComponent(city.name)}`}>
                Browse {city.name} <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline" className="rounded-full border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white">
              <Link href="/live">See what&apos;s live now</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Sibling cities ──────────────────────────────────────────── */}
      {siblings.length > 0 && (
        <section className="mt-14">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">More host cities in {countryLabel}</p>
            <Link href="/world-cup" className="text-xs text-muted-foreground hover:text-foreground">
              See all 16 →
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {siblings.map((c) => (
              <Link
                key={c.slug}
                href={`/world-cup/${c.slug}`}
                className="group relative h-24 overflow-hidden rounded-lg"
              >
                <Image
                  src={cityImageUrl(c.imagePath, 400)}
                  alt={c.displayName}
                  fill
                  sizes="50vw"
                  className="object-cover transition duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                <div className="absolute inset-0 flex items-end justify-between p-3">
                  <p className="text-sm font-semibold text-white">{c.displayName}</p>
                  <ArrowRight className="h-3.5 w-3.5 text-white/60" />
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

    </div>
  );
}
