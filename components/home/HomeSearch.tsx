"use client";

import { Search, SlidersHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { QrScanButton } from "@/components/QrScanButton";
import { FilterSidebar } from "@/components/FilterSidebar";

// Prominent top-of-home search. Sits right below the "Live & local" hero and
// routes into the full browse/search experience (which reads ?q= on load).
export function HomeSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [size, setSize] = useState("");
  const [ownership, setOwnership] = useState<string[]>([]);

  const toBrowse = (extra?: Record<string, string>) => {
    const params = new URLSearchParams();
    const term = q.trim();
    if (term) params.set("q", term);
    if (size) params.set("size", size);
    if (ownership.length) params.set("ownership", ownership.join(","));
    Object.entries(extra ?? {}).forEach(([k, v]) => params.set(k, v));
    const qs = params.toString();
    router.push(qs ? `/browse?${qs}` : "/browse");
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    toBrowse();
  };

  const toggleOwnership = (k: string) =>
    setOwnership((o) => (o.includes(k) ? o.filter((x) => x !== k) : [...o, k]));
  const activeCount = (size ? 1 : 0) + ownership.length;

  return (
    <div className="mx-auto max-w-6xl px-4 md:px-8">
      <form onSubmit={submit} className="mb-8">
        <div className="flex items-center gap-2">
          <div className="relative flex flex-1 items-center">
            <Search className="pointer-events-none absolute left-4 h-5 w-5 text-stone-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search Local"
              aria-label="Search Local"
              className="w-full rounded-full border border-stone-200 bg-white py-3.5 pl-12 pr-4 text-base shadow-sm transition placeholder-stone-400 focus:border-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-300"
            />
          </div>
          <button
            type="button"
            onClick={() => setFiltersOpen(true)}
            aria-label="Filters"
            title="Filters"
            className="relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-600 shadow-sm transition hover:border-stone-300 hover:text-stone-900"
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

      {/* Facet filters live in-place here; "Show results" carries them to /browse
          (the directory that actually filters), which reads size/ownership params. */}
      <FilterSidebar
        open={filtersOpen}
        onClose={() => {
          setFiltersOpen(false);
          if (activeCount > 0) toBrowse();
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
