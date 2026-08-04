"use client";

import Link from "next/link";
import { Compass, CalendarDays } from "lucide-react";

// Atlas — official WhatsLocal events. Featured promo card (sibling to MerchCard)
// injected into the feed + directory grid. Same vertical shape so the two read
// as a set, with teal/sky branding vs the merch card's stone/indigo.
const ATLAS_URL = "/?tab=events";
const ATLAS_IMG =
  "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1200&q=70";

export function EventsCard({ className }: { className?: string }) {
  return (
    <article
      className={`group flex h-full flex-col overflow-hidden rounded-2xl border border-teal-800 bg-teal-950 text-white shadow-sm ${className ?? ""}`}
    >
      <div className="relative min-h-[180px] flex-1 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={ATLAS_IMG}
          alt="WhatsLocal events"
          className="absolute inset-0 h-full w-full object-cover opacity-90 transition duration-300 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-teal-950 via-teal-950/20 to-transparent" />
        <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-black/40 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-white ring-1 ring-white/20 backdrop-blur">
          <Compass className="h-3 w-3" /> Official events
        </span>
        <span className="absolute bottom-3 left-4 text-xl font-bold tracking-tight drop-shadow">
          Atlas
        </span>
      </div>

      <div className="flex flex-col gap-1.5 p-4">
        <h3 className="text-base font-semibold leading-tight">Atlas events</h3>
        <p className="text-sm text-teal-100/80">Immersive cultural journeys — food, music, art &amp; stories, one culture at a time.</p>
        <div className="flex items-center justify-between gap-2 pt-2">
          <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium text-teal-100 ring-1 ring-white/10">
            Featured
          </span>
          <Link
            href={ATLAS_URL}
            className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-sm font-semibold text-teal-950 transition hover:bg-teal-50"
          >
            <CalendarDays className="h-4 w-4" /> Explore
          </Link>
        </div>
      </div>
    </article>
  );
}
