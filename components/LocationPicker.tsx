"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin, ChevronDown, X } from "lucide-react";
import { useLocation, placeLabel, placeIsSet } from "@/lib/location";

export interface PlaceOption {
  city: string;
  neighborhoods: string[];
}

// The place lens control. Shows the current scope and lets the user pick a
// city (and optionally a neighborhood). Options are derived from live data by
// the caller; a free-text city box covers anything not listed.
export function LocationPicker({ places, className = "" }: { places: PlaceOption[]; className?: string }) {
  const { place, setPlace, clear } = useLocation();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const selectedCity = places.find((p) => p.city.toLowerCase() === place.city.toLowerCase());

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-sm font-medium transition ${
          placeIsSet(place)
            ? "border-indigo-200 bg-indigo-50 text-indigo-700"
            : "border-stone-200 bg-white text-stone-700 hover:border-stone-300"
        }`}
      >
        <MapPin className="h-4 w-4" />
        <span className="max-w-[160px] truncate">{placeLabel(place)}</span>
        <ChevronDown className="h-3.5 w-3.5 opacity-60" />
      </button>

      {open && (
        <div className="absolute left-0 z-40 mt-2 w-72 rounded-2xl border border-stone-200 bg-white p-2 shadow-xl">
          <div className="flex items-center justify-between px-2 py-1">
            <p className="text-xs font-medium uppercase tracking-wide text-stone-400">Your area</p>
            {placeIsSet(place) && (
              <button onClick={() => { clear(); setOpen(false); }} className="inline-flex items-center gap-1 text-xs text-stone-500 hover:text-stone-700">
                <X className="h-3 w-3" /> Clear
              </button>
            )}
          </div>

          <button
            onClick={() => { clear(); setOpen(false); }}
            className={`w-full rounded-lg px-2 py-1.5 text-left text-sm ${!placeIsSet(place) ? "bg-indigo-50 font-medium text-indigo-700" : "text-stone-700 hover:bg-stone-50"}`}
          >
            All areas
          </button>

          <div className="mt-1 max-h-64 overflow-y-auto">
            {places.map((p) => {
              const active = p.city.toLowerCase() === place.city.toLowerCase();
              return (
                <div key={p.city}>
                  <button
                    onClick={() => setPlace({ city: p.city, neighborhood: "" })}
                    className={`w-full rounded-lg px-2 py-1.5 text-left text-sm ${active && !place.neighborhood ? "bg-indigo-50 font-medium text-indigo-700" : "text-stone-700 hover:bg-stone-50"}`}
                  >
                    {p.city}
                  </button>
                  {active && p.neighborhoods.length > 0 && (
                    <div className="ml-3 border-l border-stone-100 pl-2">
                      {p.neighborhoods.map((n) => (
                        <button
                          key={n}
                          onClick={() => { setPlace({ city: p.city, neighborhood: n }); setOpen(false); }}
                          className={`w-full rounded-lg px-2 py-1 text-left text-xs ${place.neighborhood.toLowerCase() === n.toLowerCase() ? "bg-indigo-50 font-medium text-indigo-700" : "text-stone-600 hover:bg-stone-50"}`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <form
            onSubmit={(e) => { e.preventDefault(); if (typed.trim()) { setPlace({ city: typed.trim(), neighborhood: "" }); setTyped(""); setOpen(false); } }}
            className="mt-2 border-t border-stone-100 pt-2"
          >
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="Or type a city…"
              className="w-full rounded-lg border border-stone-200 px-2 py-1.5 text-sm"
            />
          </form>
        </div>
      )}
    </div>
  );
}
