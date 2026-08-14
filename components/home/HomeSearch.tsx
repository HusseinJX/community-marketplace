"use client";

import { Search, SlidersHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { QrScanButton } from "@/components/QrScanButton";
import { FilterSidebar } from "@/components/FilterSidebar";

// Top-of-home search. Type a name, filter by business facets, or scan a QR /
// tap an NFC tag at a market. Facet filters live in-place; "Show results"
// carries them to /explore (the directory that actually filters on them —
// it reads q + size + ownership off the URL on mount).
export function HomeSearch({
  /**
   * Drop the page container. The home header band already provides
   * `max-w-6xl px-4 md:px-8`, and nesting a second copy inset the search bar
   * 32px on a phone while every card below it sat at 16px — the two could
   * never line up. Standalone callers (if any remain) keep the container.
   */
  bare = false,
}: { bare?: boolean } = {}) {
  const router = useRouter();
  const [q, setQ] = useState("");
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
            placeholder="Search local businesses"
            aria-label="Search local businesses"
            className="min-w-0 flex-1 bg-transparent px-3 py-2 t-body text-stone-900 placeholder-stone-400 focus:outline-none"
          />
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
