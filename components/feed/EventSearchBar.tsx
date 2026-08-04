"use client";

// The event search bar, lifted out of PersonalizedEvents so it can sit in the
// page's top search slot — the same place the business search occupies on the
// other tabs. Two search boxes stacked (one for businesses, one for events) is
// two inputs competing for the same intent, so the Events tab replaces the
// business one rather than adding to it.
//
// Controlled, because the submitted query drives the feed request one level up
// and submitting also switches the view to For you: this component owns the
// input's appearance, never the search state.

import { Search, X, Loader2 } from "lucide-react";

export function EventSearchBar({
  text,
  onTextChange,
  onSubmit,
  onClear,
  loading = false,
}: {
  text: string;
  onTextChange: (v: string) => void;
  /** Fired on submit with the current text. */
  onSubmit: () => void;
  onClear: () => void;
  loading?: boolean;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="rounded-2xl border border-stone-200 bg-white p-3 shadow-sm"
    >
      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 shrink-0 text-stone-400" />
        <input
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          placeholder="What are you in the mood for?"
          aria-label="Describe what you want to do"
          maxLength={400}
          className="min-w-0 flex-1 bg-transparent text-[15px] text-stone-900 outline-none placeholder:text-stone-400"
        />
        {text && (
          <button
            type="button"
            onClick={onClear}
            aria-label="Clear"
            className="rounded-full p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        <button
          type="submit"
          disabled={loading}
          className="shrink-0 rounded-full bg-stone-900 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Go"}
        </button>
      </div>
    </form>
  );
}
