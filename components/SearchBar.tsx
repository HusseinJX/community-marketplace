"use client";

import { Search, X, Sparkles } from "lucide-react";
import { useState, type FormEvent } from "react";

const EXAMPLE_QUERIES = [
  "family-owned jewelry maker",
  "specialty kite shop Chinatown",
  "comedy club SF",
  "historic Italian restaurant in North Beach",
  "bar with dance floor",
  "art gallery for underrepresented artists",
];

export function SearchBar({
  value,
  onSubmit,
  onClear,
  loading,
}: {
  value: string;
  onSubmit: (q: string) => void;
  onClear: () => void;
  loading?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const q = draft.trim();
    if (q) onSubmit(q);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <div className="relative flex items-center">
        <Search className="pointer-events-none absolute left-4 h-5 w-5 text-stone-400" />
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder='Try "family-owned jewelry maker" or "bar with dance floor"…'
          className="w-full rounded-full border border-stone-200 bg-white py-3 pl-12 pr-28 text-sm shadow-sm transition focus:border-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-300 md:text-base"
        />
        <div className="absolute right-2 flex items-center gap-1">
          {value && (
            <button
              type="button"
              onClick={() => { setDraft(""); onClear(); }}
              className="inline-flex items-center justify-center rounded-full p-2 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-full bg-stone-900 px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-stone-800 disabled:opacity-50 md:text-sm"
          >
            <Sparkles className="h-3.5 w-3.5" /> {loading ? "…" : "Search"}
          </button>
        </div>
      </div>

      {!value && (
        <div className="flex flex-wrap gap-1.5 px-1">
          <span className="text-xs text-stone-500">Try:</span>
          {EXAMPLE_QUERIES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => { setDraft(ex); onSubmit(ex); }}
              className="rounded-full border border-stone-200 bg-white px-2.5 py-0.5 text-xs text-stone-600 transition hover:border-stone-300 hover:bg-stone-50 hover:text-stone-900"
            >
              {ex}
            </button>
          ))}
        </div>
      )}
    </form>
  );
}
