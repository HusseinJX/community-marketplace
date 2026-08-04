"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { SOURCES, SOURCE_META, fetchesForSource } from "@/lib/prototype-data";
import { FetchRow } from "../../_shared";

export default function SourceFetchesPage() {
  const params = useParams();
  const id = String(params.id);
  const source = SOURCES.find((s) => s.id === id);
  const fetches = fetchesForSource(id);

  if (!source) {
    return (
      <div>
        <Link href="/prototype/admin" className="text-xs font-semibold text-stone-500">‹ Sourcing</Link>
        <p className="mt-4 text-sm text-stone-500">Source not found.</p>
      </div>
    );
  }

  const meta = SOURCE_META[source.kind];
  const count = (a: string) => fetches.filter((f) => f.action === a).length;

  return (
    <div>
      <Link href="/prototype/admin" className="text-xs font-semibold text-stone-500">‹ Sourcing</Link>

      <div className="mt-1 flex items-center gap-2">
        <span className="text-2xl">{meta.emoji}</span>
        <div>
          <h1 className="text-xl font-extrabold leading-tight tracking-tight">{source.handle}</h1>
          <p className="text-xs text-stone-400">{meta.label} · all fetches</p>
        </div>
      </div>

      {/* Summary */}
      <div className="mt-3 flex gap-2 text-xs">
        <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-bold text-emerald-700">{count("published")} published</span>
        <span className="rounded-full bg-sky-100 px-2 py-0.5 font-bold text-sky-700">{count("deduped")} deduped</span>
        <span className="rounded-full bg-amber-100 px-2 py-0.5 font-bold text-amber-700">{count("held")} held</span>
      </div>

      <div className="mt-4 space-y-1.5">
        {fetches.length === 0 ? (
          <p className="text-sm text-stone-400">No fetches yet.</p>
        ) : (
          fetches.map((f) => (
            <FetchRow key={f.id} title={f.title} action={f.action} at={f.at} note={f.note} />
          ))
        )}
      </div>
    </div>
  );
}
