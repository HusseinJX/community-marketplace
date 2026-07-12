"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, BadgeCheck } from "lucide-react";
import {
  SF_STORIES,
  SF_ENDORSEMENTS,
  type Endorser,
  type SfStory,
  type SfEndorsement,
} from "@/lib/sf-stories";

type Tab = "stories" | "endorsed";

export function SfExplorer() {
  const [tab, setTab] = useState<Tab>("endorsed");

  return (
    <div>
      {/* Tabs — "Endorsed" first + default */}
      <div className="mb-6 flex gap-2">
        <TabBtn active={tab === "endorsed"} onClick={() => setTab("endorsed")}>
          <BadgeCheck className="h-4 w-4" /> Endorsed
        </TabBtn>
        <TabBtn active={tab === "stories"} onClick={() => setTab("stories")}>
          Featured stories
        </TabBtn>
      </div>

      {tab === "endorsed" ? <Endorsed /> : <Stories />}
    </div>
  );
}

function Stories() {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {SF_STORIES.map((s: SfStory) => (
        <Link key={s.id} href={`/sf/${s.id}`}>
          <article className="card-soft card-hover group flex h-full flex-col overflow-hidden">
            <div className="relative h-44 w-full overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={s.imageUrl}
                alt=""
                className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent" />
              <div className="absolute bottom-3 left-4 right-4">
                <p className="text-[11px] font-medium uppercase tracking-wide text-white/80">
                  {s.neighborhood}
                  {s.since ? ` · ${s.since}` : ""}
                </p>
              </div>
            </div>
            <div className="flex flex-1 flex-col p-4">
              <h2 className="text-base font-semibold leading-snug text-stone-900">{s.title}</h2>
              <p className="mt-1.5 text-sm text-stone-600">{s.summary}</p>
              <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-indigo-600">
                Read <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </div>
          </article>
        </Link>
      ))}
    </div>
  );
}

function Endorsed() {
  return (
    <>
      <p className="mb-5 text-sm text-stone-500">
        Real SF spots loved, frequented, or backed by the city&apos;s celebrities and legends.
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {SF_ENDORSEMENTS.map((e: SfEndorsement) => (
          <article key={e.id} className="card-soft flex flex-col p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h2 className="text-base font-semibold leading-snug text-stone-900">{e.business}</h2>
                <p className="mt-0.5 text-xs text-stone-500">
                  {e.neighborhood} · {e.category}
                </p>
              </div>
              <BadgeCheck className="h-5 w-5 shrink-0 text-teal-500" />
            </div>

            <p className="mt-3 text-sm text-stone-600">{e.note}</p>

            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
              {e.endorsers.map((p) => (
                <span key={p.name} className="flex items-center gap-2">
                  <Avatar person={p} />
                  <span className="text-xs font-medium text-stone-700">{p.name}</span>
                </span>
              ))}
            </div>
          </article>
        ))}
      </div>
    </>
  );
}

function Avatar({ person }: { person: Endorser }) {
  const [broken, setBroken] = useState(false);
  const initials = person.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");

  if (person.img && !broken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={person.img}
        alt={person.name}
        loading="lazy"
        onError={() => setBroken(true)}
        className="h-8 w-8 rounded-full object-cover ring-1 ring-stone-200"
      />
    );
  }
  return (
    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-teal-400 to-sky-500 text-[10px] font-semibold text-white">
      {initials}
    </span>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition " +
        (active
          ? "bg-stone-900 text-white"
          : "bg-white text-stone-600 ring-1 ring-stone-200 hover:ring-stone-300")
      }
    >
      {children}
    </button>
  );
}
