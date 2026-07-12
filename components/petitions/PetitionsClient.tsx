"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, MapPin, PenLine } from "lucide-react";
import {
  DEMO_PETITIONS,
  PETITION_CATEGORIES,
  pct,
  type Petition,
  type PetitionCategory,
} from "@/lib/demo-petitions";

const STORE_KEY = "wl_signed_petitions";

function readSigned(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

export function PetitionsClient() {
  const [signed, setSigned] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<PetitionCategory | "all">("all");

  useEffect(() => setSigned(readSigned()), []);

  function sign(id: string) {
    setSigned((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev).add(id);
      try {
        window.localStorage.setItem(STORE_KEY, JSON.stringify([...next]));
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  const categories = useMemo(() => {
    const present = new Set(DEMO_PETITIONS.map((p) => p.category));
    return PETITION_CATEGORIES.filter((c) => present.has(c));
  }, []);

  const list = useMemo(
    () => (filter === "all" ? DEMO_PETITIONS : DEMO_PETITIONS.filter((p) => p.category === filter)),
    [filter]
  );

  return (
    <div>
      <div className="mb-5 -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        <Chip label="All" selected={filter === "all"} onClick={() => setFilter("all")} />
        {categories.map((c) => (
          <Chip key={c} label={c} selected={filter === c} onClick={() => setFilter(c)} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {list.map((p) => (
          <PetitionCard key={p.id} p={p} signed={signed.has(p.id)} onSign={() => sign(p.id)} />
        ))}
      </div>
    </div>
  );
}

function PetitionCard({ p, signed, onSign }: { p: Petition; signed: boolean; onSign: () => void }) {
  const count = p.signatures + (signed ? 1 : 0);
  const percent = pct(count, p.goal);

  return (
    <article className="card-soft flex flex-col overflow-hidden">
      {p.imageUrl && (
        <div className="relative h-40 w-full overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p.imageUrl} alt="" className="h-full w-full object-cover" />
          <span className="absolute left-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur">
            {p.category}
          </span>
        </div>
      )}

      <div className="flex flex-1 flex-col p-4">
        <h2 className="text-base font-semibold leading-snug text-stone-900">{p.title}</h2>
        <p className="mt-1 text-sm text-stone-600">{p.summary}</p>

        <p className="mt-2 flex items-center gap-1 text-xs text-stone-400">
          <MapPin className="h-3.5 w-3.5" /> {p.location}
        </p>
        <p className="mt-0.5 text-xs text-stone-500">
          by{" "}
          {p.orgId ? (
            <Link href={`/members/${p.orgId}`} className="font-medium text-indigo-600 hover:underline">
              {p.org}
            </Link>
          ) : (
            <span className="font-medium text-stone-700">{p.org}</span>
          )}
        </p>

        {/* Progress */}
        <div className="mt-4">
          <div className="h-2 w-full overflow-hidden rounded-full bg-stone-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-teal-500 to-emerald-500 transition-all"
              style={{ width: `${percent}%` }}
            />
          </div>
          <div className="mt-1.5 flex items-center justify-between text-xs">
            <span className="font-semibold text-stone-900">{count.toLocaleString()} signed</span>
            <span className="text-stone-400">{p.goal.toLocaleString()} goal</span>
          </div>
        </div>

        <button
          onClick={onSign}
          disabled={signed}
          className={
            "mt-4 inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition " +
            (signed
              ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
              : "bg-stone-900 text-white hover:bg-stone-800")
          }
        >
          {signed ? (
            <>
              <Check className="h-4 w-4" /> Signed — thank you
            </>
          ) : (
            <>
              <PenLine className="h-4 w-4" /> Sign this petition
            </>
          )}
        </button>
      </div>
    </article>
  );
}

function Chip({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={
        "shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition " +
        (selected
          ? "bg-stone-900 text-white"
          : "bg-white text-stone-600 ring-1 ring-stone-200 hover:ring-stone-300")
      }
    >
      {label}
    </button>
  );
}
