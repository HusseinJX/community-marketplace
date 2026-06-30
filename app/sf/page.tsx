import { Landmark } from "lucide-react";
import { SfExplorer } from "@/components/sf/SfExplorer";

export const metadata = {
  title: "San Francisco",
  description:
    "The legacy of San Francisco — the neighborhoods, the legends, and the local places that make the city what it is.",
};

export default function SfPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 pb-24 md:px-8">
      {/* Hero */}
      <section className="relative -mx-4 mb-12 overflow-hidden rounded-b-[2.5rem] md:-mx-8 md:mt-6 md:rounded-[2.5rem]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://images.unsplash.com/photo-1521747116042-5a810fda9664?auto=format&fit=crop&w=1600&q=80"
          alt="San Francisco"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-stone-950 via-stone-900/70 to-stone-900/30" />
        <div className="relative px-6 py-20 md:py-28">
          <div className="mx-auto max-w-3xl text-center text-white">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium uppercase tracking-wide ring-1 ring-white/20 backdrop-blur">
              <Landmark className="h-3.5 w-3.5" /> The city
            </span>
            <h1 className="mt-4 text-5xl font-semibold leading-[1.05] tracking-tight md:text-7xl">
              San Francisco
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-base text-stone-200 md:text-lg">
              The neighborhoods, the legends, and the local places that made the city — and the
              neighbors keeping them alive.
            </p>
          </div>
        </div>
      </section>

      <SfExplorer />
    </div>
  );
}
