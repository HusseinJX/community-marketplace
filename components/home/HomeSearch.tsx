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
export function HomeSearch() {
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
    <div className="mx-auto max-w-6xl px-4 md:px-8">
      <form onSubmit={submit}>
        <div className="flex items-center gap-2">
          <div className="relative flex flex-1 items-center">
            <Search className="pointer-events-none absolute left-3.5 h-5 w-5 text-stone-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search local businesses"
              aria-label="Search local businesses"
              className="w-full rounded-full border border-stone-200 bg-white py-3 pl-11 pr-4 text-base transition placeholder-stone-400 focus:border-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-200"
            />
          </div>
          <button
            type="button"
            onClick={() => setFiltersOpen(true)}
            aria-label="Filters"
            title="Filters"
            className="relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-600 transition hover:border-stone-300 hover:text-stone-900"
          >
            <SlidersHorizontal className="h-5 w-5" />
            {activeCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-stone-900 px-1 text-[10px] font-semibold text-white">
                {activeCount}
              </span>
            )}
          </button>
          <QrScanButton />
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
