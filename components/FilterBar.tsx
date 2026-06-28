"use client";

import type { MemberType } from "@/lib/types";
import { getCategories, getSubcategories } from "@/lib/taxonomy";

export type FilterType = MemberType | "all";

const TYPES: { key: FilterType; label: string }[] = [
  { key: "all", label: "All" },
  { key: "vendor", label: "Vendors" },
  { key: "artist", label: "Artists" },
  { key: "organizer", label: "Community" },
];

export type FilterBarProps = {
  type: FilterType;
  city: string;
  category: string;
  subcategory: string;
  onTypeChange: (t: FilterType) => void;
  onCityChange: (c: string) => void;
  onCategoryChange: (c: string) => void;
  onSubcategoryChange: (s: string) => void;
};

export function FilterBar({
  type,
  city,
  category,
  subcategory,
  onTypeChange,
  onCityChange,
  onCategoryChange,
  onSubcategoryChange,
}: FilterBarProps) {
  const categories = type !== "all" ? getCategories(type) : [];
  const subcategories =
    type !== "all" && category ? getSubcategories(type, category) : [];

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-3">
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

      {type !== "all" && categories.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => onCategoryChange("")}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              category === ""
                ? "bg-stone-800 text-white"
                : "bg-white text-stone-700 border border-stone-200 hover:bg-stone-50"
            }`}
          >
            All
          </button>
          {categories.map(c => {
            const active = category === c;
            return (
              <button
                key={c}
                type="button"
                onClick={() => onCategoryChange(c)}
                className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition ${
                  active
                    ? "bg-stone-800 text-white"
                    : "bg-white text-stone-700 border border-stone-200 hover:bg-stone-50"
                }`}
              >
                {c}
              </button>
            );
          })}
        </div>
      )}

      {type !== "all" && category && subcategories.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => onSubcategoryChange("")}
            className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition ${
              subcategory === ""
                ? "bg-stone-700 text-white"
                : "bg-stone-100 text-stone-700 hover:bg-stone-200"
            }`}
          >
            All
          </button>
          {subcategories.map(s => {
            const active = subcategory === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => onSubcategoryChange(s)}
                className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition ${
                  active
                    ? "bg-stone-700 text-white"
                    : "bg-stone-100 text-stone-700 hover:bg-stone-200"
                }`}
              >
                {s}
              </button>
            );
          })}
        </div>
      )}

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
