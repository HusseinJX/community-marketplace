"use client";

import type { MemberType } from "@/lib/types";

export type FilterType = MemberType | "all";

const TYPES: { key: FilterType; label: string }[] = [
  { key: "all", label: "All" },
  { key: "vendor", label: "Vendors" },
  { key: "artist", label: "Artists" },
  { key: "organizer", label: "Organizers" },
  { key: "shopper", label: "Shoppers" },
  { key: "influencer", label: "Influencers" },
];

export function FilterBar({
  type,
  city,
  onTypeChange,
  onCityChange,
}: {
  type: FilterType;
  city: string;
  onTypeChange: (t: FilterType) => void;
  onCityChange: (c: string) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {TYPES.map(t => {
          const active = type === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => onTypeChange(t.key)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                active
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-white text-stone-700 ring-1 ring-stone-200 hover:bg-stone-50"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2">
        <input
          type="text"
          value={city}
          onChange={e => onCityChange(e.target.value)}
          placeholder="Filter by city or neighborhood..."
          className="w-full max-w-sm rounded-xl border border-stone-200 bg-white px-4 py-2 text-sm text-stone-900 placeholder-stone-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
        />
      </div>
    </div>
  );
}
