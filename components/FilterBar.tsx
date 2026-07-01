"use client";

import type { MemberType } from "@/lib/types";
import { getCategories, getSubcategories } from "@/lib/taxonomy";
import { LayoutGrid, Store, Palette, Users } from "lucide-react";

export type FilterType = MemberType | "all";

const TYPES: { key: FilterType; label: string; icon: typeof Store }[] = [
  { key: "all", label: "All", icon: LayoutGrid },
  { key: "vendor", label: "Vendors", icon: Store },
  { key: "artist", label: "Artists", icon: Palette },
  { key: "organizer", label: "Community", icon: Users },
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
      {/* Airbnb-style segmented control — icon over label, underline on active. */}
      <div className="-mx-1 flex items-center gap-7 overflow-x-auto border-b border-stone-200 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TYPES.map(t => {
          const active = type === t.key;
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => onTypeChange(t.key)}
              className={`flex shrink-0 flex-col items-center gap-1 border-b-2 pb-2.5 pt-1 text-xs font-semibold transition ${
                active
                  ? "border-stone-900 text-stone-900"
                  : "border-transparent text-stone-400 hover:text-stone-700"
              }`}
            >
              <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 2} />
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
