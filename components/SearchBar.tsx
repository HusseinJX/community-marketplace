"use client";

import { Search, X, Sparkles } from "lucide-react";
import { useState, type FormEvent } from "react";

export type SearchMode = "normal" | "ai";

const AI_EXAMPLES = [
  "family-owned jewelry maker",
  "specialty kite shop Chinatown",
  "historic Italian restaurant in North Beach",
  "bar with dance floor",
  "art gallery for underrepresented artists",
];

const NORMAL_EXAMPLES = [
  "coffee",
  "tacos",
  "jewelry",
  "yoga",
  "vintage",
];

export function SearchBar({
  value,
  mode,
  onModeChange,
  onSubmit,
  onChange,
  onClear,
  loading,
}: {
  value: string;
  mode: SearchMode;
  onModeChange: (m: SearchMode) => void;
  onSubmit: (q: string) => void;
  onChange?: (q: string) => void;
  onClear: () => void;
  loading?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const q = draft.trim();
    if (q) onSubmit(q);
  };

  const placeholder = mode === "ai"
    ? 'Try "family-owned jewelry maker" or "bar with dance floor"…'
    : "Search names, categories, descriptions…";
  const examples = mode === "ai" ? AI_EXAMPLES : NORMAL_EXAMPLES;

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <div className="relative flex items-center">
        <Search className="pointer-events-none absolute left-4 h-5 w-5 text-stone-400" />
        <input
          type="text"
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            if (mode === "normal") onChange?.(e.target.value);
          }}
          placeholder={placeholder}
          className="w-full rounded-full border border-stone-200 bg-white py-3 pl-12 pr-44 text-sm shadow-sm transition focus:border-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-300 md:text-base md:pr-52"
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
          {/* Mode toggle — embedded inside the search field */}
          <div className="flex items-center gap-0.5 rounded-full border border-stone-200 bg-stone-50 p-0.5">
            <button
              type="button"
              onClick={() => onModeChange("normal")}
              className={
                "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition " +
                (mode === "normal" ? "bg-stone-900 text-white shadow-sm" : "text-stone-600 hover:text-stone-900")
              }
            >
              <Search className="h-3 w-3" /> Normal
            </button>
            <button
              type="button"
              onClick={() => onModeChange("ai")}
              className={
                "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition " +
                (mode === "ai" ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-sm" : "text-stone-600 hover:text-stone-900")
              }
            >
              <Sparkles className="h-3 w-3" /> AI
            </button>
          </div>
          {mode === "ai" && (
            <button
              type="submit"
              disabled={loading}
              aria-label="Search"
              className="inline-flex items-center justify-center rounded-full bg-stone-900 p-2 text-white shadow-sm transition hover:bg-stone-800 disabled:opacity-50"
            >
              {loading ? <span className="text-xs">…</span> : <Search className="h-3.5 w-3.5" />}
            </button>
          )}
        </div>
      </div>

      {!value && (
        <div className="flex flex-wrap gap-1.5 px-1">
          <span className="text-xs text-stone-500">Try:</span>
          {examples.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => {
                setDraft(ex);
                if (mode === "normal") onChange?.(ex);
                else onSubmit(ex);
              }}
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
