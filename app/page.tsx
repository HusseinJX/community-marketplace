"use client";

import { useEffect, useMemo, useState } from "react";
import { listMembers } from "@/lib/api";
import type { Member } from "@/lib/types";
import { MemberCard } from "@/components/MemberCard";
import { FilterBar, type FilterType } from "@/components/FilterBar";

export default function BrowsePage() {
  const [type, setType] = useState<FilterType>("all");
  const [city, setCity] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    listMembers({ type, city: city || undefined, limit: 100 })
      .then(res => {
        if (!cancelled) setMembers(res.members);
      })
      .catch(err => {
        if (!cancelled) setError(err.message || "Failed to load members.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [type, city]);

  const visible = useMemo(
    () => members.filter(m => m.profile?.name),
    [members]
  );

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <section className="mb-10">
        <h1 className="text-4xl font-semibold tracking-tight text-stone-900 sm:text-5xl">
          Discover Your Community
        </h1>
        <p className="mt-3 max-w-2xl text-base text-stone-600">
          Browse the makers, organizers, vendors, and neighbors building local
          life around you. Filter by who you are looking for.
        </p>
      </section>

      <section className="mb-8">
        <FilterBar
          type={type}
          city={city}
          onTypeChange={setType}
          onCityChange={setCity}
        />
      </section>

      {loading && (
        <div className="py-20 text-center text-stone-500">Loading members...</div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      {!loading && !error && visible.length === 0 && (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white/40 p-12 text-center">
          <p className="text-base text-stone-700">No members match your filters yet.</p>
          <p className="mt-1 text-sm text-stone-500">
            Try clearing the city filter or selecting a different category.
          </p>
        </div>
      )}

      {!loading && visible.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visible.map(m => (
            <MemberCard key={m.id} member={m} />
          ))}
        </div>
      )}
    </div>
  );
}
