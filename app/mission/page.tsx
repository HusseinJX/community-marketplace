import Link from "next/link";
import { ArrowLeft, Globe2, Network, Sparkles, Users } from "lucide-react";

export const metadata = {
  title: "Our Mission — The Collective",
  description:
    "Surfacing the real network of local communities — unifying social dynamics, culture, and shared infrastructure into a richer global society.",
};

export default function MissionPage() {
  return (
    <div className="bg-stone-50">
      <section className="relative overflow-hidden bg-gradient-to-br from-stone-900 via-purple-900 to-pink-800 text-white">
        <div className="absolute inset-0 opacity-30 [background:radial-gradient(circle_at_20%_20%,rgba(236,72,153,0.4),transparent_50%),radial-gradient(circle_at_80%_60%,rgba(168,85,247,0.4),transparent_55%)]" />
        <div className="relative mx-auto max-w-4xl px-4 pb-20 pt-16 md:px-8 md:pt-24">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-white/70 transition hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" /> Back home
          </Link>
          <div className="mt-8 ml-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium backdrop-blur">
            <Sparkles className="h-3.5 w-3.5" /> Our Mission
          </div>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight md:text-6xl">
            We need to find each other.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-white/85 md:text-xl">
            A network revolution — optimizing the connections we already have before we scale anything else exponentially. The network is still broken. Let&rsquo;s fix it together.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-4xl space-y-10 px-4 py-16 md:px-8 md:py-24">
        <article className="max-w-none">
          <p className="text-lg leading-relaxed text-stone-700">
            Everything is being scaled up right where it is. More content, more commerce, more connections, more noise — all stacked on top of an underlying network that hasn&rsquo;t been re-thought in a generation. What we need more than ever isn&rsquo;t more scale. It&rsquo;s a better network.
          </p>
          <p className="mt-6 text-lg leading-relaxed text-stone-700">
            Our mission is to surface and unify the real semantic social dynamics that already exist around us: a living network of local communities and a global mesh of social connection, discourse, culture, resource flow, and shared infrastructure. Shared living. A unified global culture — not an aesthetic, a fabric.
          </p>
          <p className="mt-6 text-lg leading-relaxed text-stone-700">
            It isn&rsquo;t a fancy thing. It&rsquo;s that these intentions and these relationships need to become <em>convenient</em>. When the network is legible and easy to participate in, society gets richer almost on its own. That is the work.
          </p>
        </article>

        <div className="grid gap-4 sm:grid-cols-3">
          <Pillar icon={<Network className="h-5 w-5" />} title="Optimize the network" body="Before we scale further, make the connections themselves work. Surface what's already real." />
          <Pillar icon={<Users className="h-5 w-5" />} title="Unify local + global" body="A real network of local communities woven into a global culture of shared infrastructure." />
          <Pillar icon={<Globe2 className="h-5 w-5" />} title="Make it convenient" body="Discourse, resource flow, shared living — easy enough that participation is the default." />
        </div>

        <div className="rounded-3xl bg-gradient-to-r from-pink-500 to-purple-600 p-8 text-white shadow-lg md:p-10">
          <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
            Help surface the network.
          </h2>
          <p className="mt-2 max-w-2xl text-white/90">
            Support keeps this independent and lets us keep building the connective tissue of a richer society.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-purple-700 transition hover:bg-stone-100"
            >
              Support the work
            </Link>
            <a
              href="https://spaceagevision.com"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-white/10 px-5 py-2.5 text-sm font-medium text-white ring-1 ring-white/30 backdrop-blur transition hover:bg-white/20"
            >
              Space Age Vision
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}

function Pillar({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5">
      <div className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-r from-pink-500 to-purple-600 text-white">
        {icon}
      </div>
      <h3 className="mt-3 text-base font-semibold text-stone-900">{title}</h3>
      <p className="mt-1 text-sm text-stone-600">{body}</p>
    </div>
  );
}
