"use client";

import { useEffect, useMemo, useState } from "react";
import { listMembers } from "@/lib/api";
import type { Member } from "@/lib/types";
import { MemberCard } from "@/components/MemberCard";
import { FilterBar, type FilterType } from "@/components/FilterBar";
import { MapView } from "@/components/MapView";

type ViewMode = "grid" | "map";

export default function BrowsePage() {
  const [type, setType] = useState<FilterType>("all");
  const [city, setCity] = useState("");
  const [category, setCategory] = useState("");
  const [subcategory, setSubcategory] = useState("");
  const [view, setView] = useState<ViewMode>("grid");
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    listMembers({
      type,
      city: city || undefined,
      category: category || undefined,
      subcategory: subcategory || undefined,
      limit: 100,
    })
      .then((res) => {
        if (!cancelled) setMembers(res.members);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Failed to load members.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [type, city, category, subcategory]);

  const visible = useMemo(() => members.filter((m) => m.profile?.name), [members]);

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <section className="mb-10">
        <h1 className="text-4xl font-semibold tracking-tight text-stone-900 sm:text-5xl">
          Discover Your Community
        </h1>
        <p className="mt-3 max-w-2xl text-base text-stone-600">
          Browse the makers, organizers, vendors, and neighbors building local
          life around you.
        </p>
      </section>

      <section className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <FilterBar
          type={type}
          city={city}
          category={category}
          subcategory={subcategory}
          onTypeChange={(t) => {
            setType(t);
            setCategory("");
            setSubcategory("");
          }}
          onCityChange={setCity}
          onCategoryChange={(c) => {
            setCategory(c);
            setSubcategory("");
          }}
          onSubcategoryChange={setSubcategory}
        />

        {/* View toggle */}
        <div className="flex shrink-0 overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm">
          <button
            onClick={() => setView("grid")}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition ${
              view === "grid"
                ? "bg-indigo-600 text-white"
                : "text-stone-600 hover:bg-stone-50"
            }`}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
            Grid
          </button>
          <button
            onClick={() => setView("map")}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition ${
              view === "map"
                ? "bg-indigo-600 text-white"
                : "text-stone-600 hover:bg-stone-50"
            }`}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            Map
          </button>
        </div>
      </section>

      {loading && (
        <div className="py-20 text-center text-stone-500">Loading members...</div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      {!loading && !error && (
        <>
          {view === "map" && (
            <MapView members={visible} />
          )}

          {view === "grid" && visible.length === 0 && (
            <div className="rounded-2xl border border-dashed border-stone-300 bg-white/40 p-12 text-center">
              <p className="text-base text-stone-700">No members match your filters yet.</p>
              <p className="mt-1 text-sm text-stone-500">
                Try clearing the city filter or selecting a different category.
              </p>
            </div>
          )}

          {view === "grid" && visible.length > 0 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {visible.map((m) => (
                <MemberCard key={m.id} member={m} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
