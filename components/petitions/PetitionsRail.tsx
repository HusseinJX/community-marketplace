"use client";

import Link from "next/link";
import { ArrowRight, PenLine } from "lucide-react";
import { DEMO_PETITIONS, pct } from "@/lib/demo-petitions";

// Compact home-screen strip surfacing active local petitions so people discover
// them without bumping into a canvasser. Links into the full /petitions page.
export function PetitionsRail() {
  const items = DEMO_PETITIONS.slice(0, 6);
  if (items.length === 0) return null;

  return (
    <section className="mb-6 overflow-hidden rounded-2xl border border-teal-100 bg-gradient-to-br from-teal-50 to-emerald-50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-teal-800">
          <PenLine className="h-4 w-4" /> Petitions near you
        </h2>
        <Link
          href="/petitions"
          className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 hover:text-teal-900"
        >
          See all <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
        {items.map((p) => {
          const percent = pct(p.signatures, p.goal);
          return (
            <Link
              key={p.id}
              href="/petitions"
              className="group flex w-56 shrink-0 flex-col overflow-hidden rounded-xl bg-white/80 ring-1 ring-teal-100 transition hover:ring-teal-300"
            >
              {p.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.imageUrl} alt="" className="h-24 w-full object-cover" />
              )}
              <div className="flex flex-1 flex-col p-3">
                <p className="text-[11px] font-medium text-teal-700">{p.category}</p>
                <p className="mt-0.5 line-clamp-2 text-sm font-semibold leading-snug text-stone-900">
                  {p.title}
                </p>
                <div className="mt-auto pt-2">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-stone-100">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-teal-500 to-emerald-500"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  <p className="mt-1 text-[11px] font-medium text-stone-500">
                    {p.signatures.toLocaleString()} signed
                  </p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
