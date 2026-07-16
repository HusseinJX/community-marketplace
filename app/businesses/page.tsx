import type { Metadata } from "next";
import Link from "next/link";
import { BusinessMatchDemo } from "./BusinessMatchDemo";

// Public business front door — NO LOGIN.
//
// The wedge (the matcher) lived behind Clerk at /vendor, so a bar owner landing
// on the site met a shopper feed and had to be TOLD what the app is. This is the
// /organizers treatment for businesses: the real matcher, on canned candidates,
// touchable before signup. Sign-up is the invite button.
export const metadata: Metadata = {
  title: "For businesses",
  description:
    "Find the local businesses worth teaming up with — matched by what you offer and what you need — and put on an event together.",
};

const STEPS = [
  { n: "1", t: "We bring you the idea", d: "Not a list of businesses — a specific night, with the specific people to do it with, and why each one is there." },
  { n: "2", t: "Invite them", d: "One tap. They get an invite and a shared thread with you." },
  { n: "3", t: "Everyone says they’re in", d: "Agree in the thread. No group chat, no spreadsheet." },
  { n: "4", t: "The event goes live", d: "It publishes to the neighborhood feed, with every business on the card." },
];

export default function BusinessesPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-6 md:px-8">
      <span className="inline-flex rounded-full bg-stone-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-stone-600">
        Sample ideas — open one
      </span>
      <h1 className="mt-3 text-xl font-semibold text-stone-900">
        Collaborations you&apos;d never have thought of.
      </h1>
      <p className="mt-1.5 text-[13px] leading-relaxed text-stone-600">
        Not a directory, and not a list of names. We look at what you offer and what the businesses
        around you need, then hand you a fully-formed idea: the event, who&apos;s in it, why it works,
        and the first three moves. Open one below.
      </p>

      <div className="mt-6">
        <BusinessMatchDemo />
      </div>

      <div className="mt-10 grid gap-3 sm:grid-cols-2">
        {STEPS.map((s) => (
          <div key={s.n} className="card-soft p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">Step {s.n}</p>
            <p className="mt-1 text-sm font-semibold text-stone-900">{s.t}</p>
            <p className="mt-0.5 text-[13px] leading-snug text-stone-600">{s.d}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Link
          href="/join"
          className="rounded-full bg-stone-900 px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-stone-800"
        >
          Add your business
        </Link>
        <Link href="/organizers" className="text-[13px] font-medium text-stone-600 hover:text-stone-900">
          Running a market or festival? →
        </Link>
      </div>
    </div>
  );
}
