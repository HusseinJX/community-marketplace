import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  Sparkles,
  CalendarHeart,
  HandHeart,
  BookOpen,
  Waypoints,
} from "lucide-react";

export const metadata: Metadata = {
  title: "What's this about?",
  description:
    "WhatsLocal AI connects your neighborhood — showcasing local stories, bringing people together at real-world events, celebrating businesses that support community orgs, and gathering resources for people and small businesses.",
  alternates: { canonical: "/about" },
};

type Section = {
  icon: typeof Sparkles;
  eyebrow: string;
  title: string;
  body: string;
  href: string;
  cta: string;
  accent: string; // tailwind gradient classes for the icon chip
};

const SECTIONS: Section[] = [
  {
    icon: Sparkles,
    eyebrow: "Showcase",
    title: "We showcase the core trio",
    body: "Not general stories — we spotlight three kinds of neighbors specifically: small local businesses, artists, and community organizations. Each one has a profile that tells who they are and what they do, so the people who make a place feel seen, not scrolled past.",
    href: "/sf",
    cta: "Meet local members",
    accent: "from-fuchsia-500 to-purple-600",
  },
  {
    icon: CalendarHeart,
    eyebrow: "Events",
    title: "Real events, made by members",
    body: "Not a random events feed — these are created by our members and their collaborations: a market a business hosts, a show an artist puts on, a festival an organizer pulls together. Community happening in real life, built by the people in it.",
    href: "/events",
    cta: "Find events near you",
    accent: "from-rose-500 to-pink-600",
  },
  {
    icon: HandHeart,
    eyebrow: "Giving back",
    title: "Businesses that support the community",
    body: "When a local business backs a community org — with funds, goods, or time — that support should be visible. We show which businesses are giving back, enriching and strengthening the ecosystem that everyone shares.",
    href: "/vendor/giving",
    cta: "See who gives back",
    accent: "from-emerald-500 to-teal-600",
  },
  {
    icon: BookOpen,
    eyebrow: "Resources",
    title: "Resources for people & small businesses",
    body: "Help exists — but it's scattered. We gather it in one place: food, housing, health, legal aid and more for residents, plus grants, permits, and growth support for small businesses. Browse what's out there, all in one guide.",
    href: "/resources",
    cta: "Browse resources",
    accent: "from-sky-500 to-indigo-600",
  },
];

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-8 md:px-8">
      {/* Hero */}
      <div className="rounded-3xl bg-gradient-to-br from-purple-700 to-pink-600 px-6 py-10 text-white sm:px-10 sm:py-12">
        <p className="text-xs font-semibold uppercase tracking-widest text-white/70">
          WhatsLocal AI
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
          Your neighborhood, all in one place.
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-white/85 sm:text-lg">
          WhatsLocal is where a community sees itself — the stories worth telling, the events
          that bring people together, the businesses that give back, and the resources that
          help everyone get by and grow.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-purple-700 transition hover:bg-white/90"
        >
          Explore what&apos;s local
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {/* Mission card — the "why" behind everything else. */}
      <section className="mt-8 overflow-hidden rounded-2xl border border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50 p-6 shadow-sm sm:p-8">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-purple-600 to-pink-600 text-white">
            <Waypoints className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-purple-500">
              Why we exist
            </p>
            <h2 className="mt-0.5 text-lg font-semibold tracking-tight text-stone-900 sm:text-xl">
              A network of local ecosystems, connected by a living tissue
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-stone-700 sm:text-[0.95rem]">
              WhatsLocal is a network of local ecosystems — the people, makers, businesses, and
              community organizations of a place — connected by a connective tissue that enriches
              the community and encourages collaboration across it. First and foremost, we exist to
              <span className="font-semibold text-stone-900"> support and strengthen the local ecosystem</span>.
              Everything else is how that shows up for you.
            </p>
          </div>
        </div>
      </section>

      {/* Rainforest analogy — the ecosystem as living strata, roots = us. */}
      <section className="mt-6">
        <div className="mb-3 px-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">The analogy</p>
          <h2 className="mt-0.5 text-lg font-semibold tracking-tight text-stone-900 sm:text-xl">
            A living ecosystem, like a rainforest
          </h2>
          <p className="mt-1 text-sm text-stone-500">
            Every layer depends on the others — and the unseen network beneath connects them all.
          </p>
        </div>

        {/* The illustrated ecosystem */}
        <div className="overflow-hidden rounded-2xl border border-stone-200 shadow-sm">
          <Image
            src="/rainforest-ecosystem.png"
            alt="A living ecosystem, in five layers: emergent layer, canopy, understory, forest floor, and roots & fungi — the connective tissue."
            width={1122}
            height={1402}
            className="h-auto w-full"
            priority
          />
        </div>

        {/* The insight: life is in the middle; we work at the roots. */}
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 sm:p-6">
          <p className="text-sm leading-relaxed text-stone-700 sm:text-[0.95rem]">
            In a rainforest, most of the life — the color, the flowers, the animals, the everyday
            beauty — lives in the <span className="font-semibold text-emerald-800">understory and
            forest floor</span>. That&apos;s where the real people are: local businesses, artists,
            events, neighbors, and the organizations that care for them.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-stone-700 sm:text-[0.95rem]">
            WhatsLocal works one layer deeper — at the{" "}
            <span className="font-semibold text-emerald-800">roots &amp; fungi</span>. We
            strengthen the connective tissue: the unseen network that routes support, nutrients, and
            connection between everyone, so all the life above it can flourish.
          </p>
        </div>

        <p className="mt-4 px-1 text-center text-xs italic text-stone-500">
          One living network. Many forms. Shared purpose. Collective flourishing.
        </p>
      </section>

      {/* Sections */}
      <p className="mt-6 px-1 text-xs font-semibold uppercase tracking-wide text-stone-400">
        For you, that shows up as
      </p>
      <div className="mt-3 space-y-4">
        {SECTIONS.map(({ icon: Icon, eyebrow, title, body, href, cta, accent }, i) => (
          <section
            key={eyebrow}
            className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm sm:p-7"
          >
            <div className="flex items-start gap-4">
              <div
                className={
                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white " +
                  accent
                }
              >
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">
                  {String(i + 1).padStart(2, "0")} · {eyebrow}
                </p>
                <h2 className="mt-0.5 text-lg font-semibold tracking-tight text-stone-900 sm:text-xl">
                  {title}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-stone-600 sm:text-[0.95rem]">
                  {body}
                </p>
                <Link
                  href={href}
                  className="group mt-3 inline-flex items-center gap-1 text-sm font-semibold text-purple-700 transition hover:text-purple-900"
                >
                  {cta}
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                </Link>
              </div>
            </div>
          </section>
        ))}
      </div>

      {/* Footer CTA */}
      <div className="mt-8 rounded-2xl border border-stone-200 bg-stone-100 p-6 text-center sm:p-8">
        <h2 className="text-lg font-semibold tracking-tight text-stone-900">
          Ready to dig in?
        </h2>
        <p className="mt-1 text-sm text-stone-600">
          Everything local — live now, what&apos;s on, and who&apos;s around you.
        </p>
        <Link
          href="/"
          className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-stone-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-stone-700"
        >
          Go to WhatsLocal
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
