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
import { QrScanButton } from "@/components/QrScanButton";

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
      className="flex items-center gap-1 rounded-full border border-stone-200 bg-white p-1.5 pl-4 shadow-[var(--shadow-soft)] transition focus-within:shadow-[var(--shadow-lift)] hover:shadow-[var(--shadow-lift)]"
    >
      <Search className="pointer-events-none h-5 w-5 shrink-0 text-stone-500" />
        <input
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          placeholder="What are you in the mood for?"
          aria-label="Describe what you want to do"
          maxLength={400}
          className="min-w-0 flex-1 bg-transparent px-3 py-2 t-body text-stone-900 placeholder-stone-400 focus:outline-none"
        />
        {text && (
          <button
            type="button"
            onClick={onClear}
            aria-label="Clear"
            title="Clear search"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-stone-500 transition hover:bg-stone-100 hover:text-stone-900"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        <QrScanButton />
        <button
          type="submit"
          disabled={loading}
          aria-label="Search events"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-coral-600 text-white transition hover:bg-coral-700 disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </button>
    </form>
  );
}
