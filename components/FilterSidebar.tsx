"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { BUSINESS_SIZES, OWNERSHIP_TAGS } from "@/lib/business-facets";

// Slide-in filter panel for business facets (size + ownership/type), opened from
// the search bar's filter button on the home screen.
export function FilterSidebar({
  open,
  onClose,
  size,
  ownership,
  onSizeChange,
  onToggleOwnership,
  onClear,
}: {
  open: boolean;
  onClose: () => void;
  size: string;
  ownership: string[];
  onSizeChange: (s: string) => void;
  onToggleOwnership: (k: string) => void;
  onClear: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const active = (size ? 1 : 0) + ownership.length;

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 z-40 bg-stone-900/40 backdrop-blur-sm transition-opacity ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
        onClick={onClose}
        aria-hidden
      />
      {/* Panel — full-height left sidebar; white fills to the very top, the
          header content is padded below the notch so the title + X are clear. */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-80 max-w-[85vw] flex-col bg-white shadow-2xl transition-transform duration-200 ${open ? "translate-x-0" : "-translate-x-full"}`}
        aria-label="Filters"
      >
        <div
          className="flex items-center justify-between border-b border-stone-100 px-5 pb-4"
          style={{ paddingTop: "calc(env(safe-area-inset-top) + 1rem)" }}
        >
          <h2 className="text-base font-semibold text-stone-900">Filters{active > 0 ? ` · ${active}` : ""}</h2>
          <button onClick={onClose} className="rounded-full p-1.5 text-stone-400 hover:bg-stone-100" aria-label="Close filters">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
          <div>
            <p className="section-label mb-2">Business size</p>
            <div className="flex flex-col gap-1.5">
              {BUSINESS_SIZES.map((s) => (
                <label key={s.key} className="flex cursor-pointer items-center gap-2 text-sm text-stone-700">
                  <input
                    type="radio"
                    name="biz-size"
                    checked={size === s.key}
                    onChange={() => onSizeChange(size === s.key ? "" : s.key)}
                    onClick={() => size === s.key && onSizeChange("")}
                    className="accent-stone-900"
                  />
                  {s.label}
                </label>
              ))}
            </div>
          </div>

          <div>
            <p className="section-label mb-2">Ownership &amp; type</p>
            <div className="flex flex-wrap gap-1.5">
              {OWNERSHIP_TAGS.map((o) => (
                <button
                  key={o.key}
                  onClick={() => onToggleOwnership(o.key)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${ownership.includes(o.key) ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200"}`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div
          className="flex items-center gap-2 border-t border-stone-100 px-5 pt-4"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}
        >
          <button onClick={onClear} disabled={active === 0} className="text-sm text-stone-500 hover:text-stone-800 disabled:opacity-40">
            Clear all
          </button>
          <button onClick={onClose} className="ml-auto rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800">
            Show results
          </button>
        </div>
      </aside>
    </>
  );
}
