"use client";

import { Search, SlidersHorizontal, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { QrScanButton } from "@/components/QrScanButton";
import { FilterSidebar } from "@/components/FilterSidebar";

// Top-of-home search. Type a name, filter by business facets, or scan a QR /
// tap an NFC tag at a market.
//
// TWO MODES:
//   • navigate (default) — submitting carries q + facets to /explore, the
//     directory that actually filters on them (it reads them off the URL).
//   • filter — the caller passes `value`/`onValueChange` and the box becomes a
//     live keyword filter over whatever that tab is already showing. Nothing
//     navigates: the Shops and Products tabs both hold their whole catalogue
//     client-side, so leaving the page to search inside it was a round trip for
//     a substring match. The facet button is dropped in this mode — it can only
//     answer by navigating to /explore, which is exactly what filtering here is
//     meant to avoid.
export function HomeSearch({
  /**
   * Drop the page container. The home header band already provides
   * `max-w-6xl px-4 md:px-8`, and nesting a second copy inset the search bar
   * 32px on a phone while every card below it sat at 16px — the two could
   * never line up. Standalone callers (if any remain) keep the container.
   */
  bare = false,
  /** Filter mode: the current keyword, owned by the caller. */
  value,
  /** Filter mode: pass this to switch the box from navigating to filtering. */
  onValueChange,
  placeholder = "Search local businesses",
}: {
  bare?: boolean;
  value?: string;
  onValueChange?: (v: string) => void;
  placeholder?: string;
} = {}) {
  const router = useRouter();
  const [own, setOwn] = useState("");
  const filtering = !!onValueChange;
  const q = filtering ? (value ?? "") : own;
  const setQ = (v: string) => (onValueChange ? onValueChange(v) : setOwn(v));
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [size, setSize] = useState("");
  const [ownership, setOwnership] = useState<string[]>([]);

  const toResults = (extra?: Record<string, string>) => {
    const params = new URLSearchParams();
    const term = q.trim();
    if (term) params.set("q", term);
    if (size) params.set("size", size);
    if (ownership.length) params.set("ownership", ownership.join(","));
    Object.entries(extra ?? {}).forEach(([k, v]) => params.set(k, v));
    const qs = params.toString();
    router.push(qs ? `/explore?${qs}` : "/explore");
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    // Filtering already happened on every keystroke — submitting only means
    // "I'm done typing", so all it does is put the phone keyboard away.
    if (filtering) {
      (document.activeElement as HTMLElement | null)?.blur();
      return;
    }
    toResults();
  };

  const toggleOwnership = (k: string) =>
    setOwnership((o) => (o.includes(k) ? o.filter((x) => x !== k) : [...o, k]));
  const activeCount = (size ? 1 : 0) + ownership.length;

  return (
    <div className={bare ? "" : "mx-auto max-w-6xl px-4 md:px-8"}>
      <form onSubmit={submit}>
        {/* The search PILL. One rounded bar carrying the query, the facets and
            the scanner — rather than an input with two naked circles floating
            beside it, which is what this was. Elevation instead of a border, so
            it reads as the one raised object on a flat page (Airbnb's does the
            same, and it is most of why their header feels solid). */}
        <div className="flex items-center gap-1 rounded-full border border-stone-200 bg-white p-1.5 pl-4 shadow-[var(--shadow-soft)] transition focus-within:shadow-[var(--shadow-lift)] hover:shadow-[var(--shadow-lift)]">
          <Search className="pointer-events-none h-5 w-5 shrink-0 text-stone-500" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={placeholder}
            aria-label={placeholder}
            className="min-w-0 flex-1 bg-transparent px-3 py-2 t-body text-stone-900 placeholder-stone-400 focus:outline-none"
          />
          {/* Filtering hides the whole page behind a word, so there has to be a
              one-tap way back to everything. */}
          {filtering && q && (
            <button
              type="button"
              onClick={() => setQ("")}
              aria-label="Clear search"
              title="Clear search"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-stone-500 transition hover:bg-stone-100 hover:text-stone-900"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          {!filtering && (
            <button
              type="button"
              onClick={() => setFiltersOpen(true)}
              aria-label="Filters"
              title="Filters"
              className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full text-stone-600 transition hover:bg-stone-100 hover:text-stone-900"
            >
              <SlidersHorizontal className="h-4 w-4" />
              {activeCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-stone-900 px-1 text-[10px] font-semibold text-white">
                  {activeCount}
                </span>
              )}
            </button>
          )}
          <QrScanButton />
          {/* The submit target. Coral — this is the page's primary action and
              the accent is reserved for exactly that. */}
          <button
            type="submit"
            aria-label="Search"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-coral-600 text-white transition hover:bg-coral-700"
          >
            <Search className="h-4 w-4" />
          </button>
        </div>
      </form>

      <FilterSidebar
        open={filtersOpen}
        onClose={() => {
          setFiltersOpen(false);
          if (activeCount > 0) toResults();
        }}
        size={size}
        ownership={ownership}
        onSizeChange={setSize}
        onToggleOwnership={toggleOwnership}
        onClear={() => { setSize(""); setOwnership([]); }}
      />
    </div>
  );
}
