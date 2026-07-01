"use client";

import { Search, X, SlidersHorizontal } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

export type SearchMode = "normal" | "ai";

export function SearchBar({
  value,
  mode,
  onSubmit,
  onChange,
  onClear,
  onOpenFilters,
  activeFilters = 0,
}: {
  value: string;
  mode: SearchMode;
  // Kept for prop compatibility with the parent; the in-field toggle is hidden.
  onModeChange: (m: SearchMode) => void;
  onSubmit: (q: string) => void;
  onChange?: (q: string) => void;
  onClear: () => void;
  onOpenFilters?: () => void;
  activeFilters?: number;
  loading?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  // Reflect an externally-seeded value (e.g. a ?q= deep link) in the input.
  useEffect(() => { setDraft(value); }, [value]);
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const q = draft.trim();
    if (q) onSubmit(q);
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="relative flex items-center">
        <Search className="pointer-events-none absolute left-4 h-5 w-5 text-stone-400" />
        <input
          type="text"
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            if (mode === "normal") onChange?.(e.target.value);
          }}
          placeholder="Search names, categories, descriptions…"
          className="w-full rounded-full border border-stone-200 bg-white py-3 pl-12 pr-20 text-sm shadow-sm transition focus:border-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-300 md:text-base"
        />
        <div className="absolute right-2 flex items-center gap-1.5">
          {value && (
            <button
              type="button"
              onClick={() => { setDraft(""); onClear(); }}
              className="inline-flex items-center justify-center rounded-full p-1.5 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          {onOpenFilters && (
            <button
              type="button"
              onClick={onOpenFilters}
              className="relative inline-flex items-center justify-center rounded-full p-1.5 text-stone-500 transition hover:bg-stone-100 hover:text-stone-900"
              aria-label="Open filters"
            >
              <SlidersHorizontal className="h-5 w-5" />
              {activeFilters > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-stone-900 px-1 text-[10px] font-semibold text-white">
                  {activeFilters}
                </span>
              )}
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
