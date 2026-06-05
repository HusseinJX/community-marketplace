import Link from "next/link";
import { ArrowLeft, ExternalLink, Leaf, Plane, Sprout, Globe2 } from "lucide-react";

export const metadata = {
  title: "Wild Earth",
  description: "Exploration, regeneration, and reconnection with the living world.",
};

export default function TravelPage() {
  return (
    <div className="bg-stone-50">
      <section className="relative overflow-hidden bg-gradient-to-br from-emerald-900 via-teal-800 to-amber-700 text-white">
        <div className="absolute inset-0 opacity-30 [background:radial-gradient(circle_at_20%_30%,rgba(16,185,129,0.5),transparent_50%),radial-gradient(circle_at_80%_70%,rgba(245,158,11,0.4),transparent_55%)]" />
        <div className="relative mx-auto max-w-4xl px-4 pb-20 pt-16 md:px-8 md:pt-24">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-white/70 transition hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" /> Back home
          </Link>
          <div className="mt-8 ml-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium backdrop-blur">
            <Plane className="h-3.5 w-3.5" /> Wild Earth
          </div>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight md:text-6xl">
            Reconnect with the living world.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-white/85 md:text-xl">
            Wild Earth is about exploration, regeneration, and remembering we&rsquo;re part of an ecosystem — not above it. Trips, stories, and field notes from the places still teaching us how to live.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="https://delicate-yeot-d2d556.netlify.app/"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-stone-900 transition hover:bg-stone-100"
            >
              Open the website <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-4xl space-y-10 px-4 py-16 md:px-8 md:py-24">
        <div className="grid gap-4 sm:grid-cols-3">
          <Pillar icon={<Leaf className="h-5 w-5" />} title="Regeneration" body="Stewardship of the land — leaving every place more alive than we found it." />
          <Pillar icon={<Sprout className="h-5 w-5" />} title="Field learning" body="Hands in the dirt. The teachers are the rivers, the soil, and the people closest to it." />
          <Pillar icon={<Globe2 className="h-5 w-5" />} title="Wider belonging" body="A reminder that community isn&rsquo;t just human — it&rsquo;s the whole living network." />
        </div>

        <article className="rounded-3xl border border-stone-200 bg-white p-8 md:p-10">
          <h2 className="text-2xl font-semibold tracking-tight text-stone-900">
            The wild isn&rsquo;t out there. It&rsquo;s the substrate.
          </h2>
          <p className="mt-3 text-stone-700">
            Wild Earth gathers trips, projects, and stories that connect the communities we build to the ecosystems we live inside. Because a healthy human network and a healthy planetary one are the same project.
          </p>
        </article>
      </section>
    </div>
  );
}

function Pillar({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5">
      <div className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-r from-emerald-500 to-amber-500 text-white">
        {icon}
      </div>
      <h3 className="mt-3 text-base font-semibold text-stone-900">{title}</h3>
      <p className="mt-1 text-sm text-stone-600">{body}</p>
    </div>
  );
}
