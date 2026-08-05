"use client";

// Admin → Sourcing. The REAL one.
//
// What this replaced rendered six invented sources with invented run stats.
// Every number here is measured: the recipes come from lib/sources/registry,
// the counts from the events those recipes actually wrote.
//
// The screen's job is to answer two questions honestly:
//   1. Which cities are we in — and the answer is "the ones with a source",
//      because that is the only definition of live (lib/cities.ts).
//   2. Is each source still working — which is why the drift baseline is shown
//      next to what a source is actually holding. "0 events" and "a quiet week"
//      look identical without it.

import { useState } from "react";
import useSWR from "swr";
import { ExternalLink, MapPin, Loader2, AlertTriangle } from "lucide-react";

interface SourceRow {
  id: string;
  label: string;
  site: string;
  city: string;
  category: string;
  pattern: string;
  enabled: boolean;
  total: number;
  published: number;
  pending: number;
  lastSeen: string | null;
  expectAtLeast: number | null;
}
interface CityRow {
  id: string;
  city: string;
  emoji: string;
  live: boolean;
  sourceCount: number;
  published: number;
}

export function SourcingPanel({ onDetailChange }: { onDetailChange?: (open: boolean) => void } = {}) {
  const { data, isLoading } = useSWR<{ cities: CityRow[]; sources: SourceRow[] }>("/api/admin/sources");
  const [cityId, setCityId] = useState<string | null>(null);

  const cities = data?.cities ?? [];
  const sources = data?.sources ?? [];
  const city = cities.find((c) => c.id === cityId) ?? null;

  const open = (id: string | null) => {
    setCityId(id);
    onDetailChange?.(!!id);
  };

  if (isLoading && !data) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-stone-400" />
      </div>
    );
  }

  // ── City detail ──────────────────────────────────────────────────────────
  if (city) {
    const mine = sources.filter((s) => s.city === city.id);
    return (
      <div>
        <button
          onClick={() => open(null)}
          className="mb-4 inline-flex items-center gap-1 text-sm text-indigo-700 hover:underline"
        >
          ‹ All cities
        </button>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <h2 className="text-xl font-semibold tracking-tight text-stone-900">
            {city.emoji} {city.city}
          </h2>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              city.live ? "bg-emerald-50 text-emerald-700" : "bg-stone-100 text-stone-500"
            }`}
          >
            {city.live ? "Live" : "Not live"}
          </span>
        </div>

        {/* The activation rule, said out loud where someone might be looking
            for a switch to flip. There isn't one — there is only adding a
            source, and this is the screen where that would be expected. */}
        <p className="mb-5 rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-[13px] leading-snug text-stone-600">
          {city.live ? (
            <>
              Live because <b>{city.sourceCount} source{city.sourceCount === 1 ? "" : "s"}</b> feed it. Turn every
              source off and the city goes dark — there is no separate switch.
            </>
          ) : (
            <>
              No sources yet, so this city is not live. Adding one to{" "}
              <code className="rounded bg-white px-1 py-0.5 text-[12px]">lib/sources/registry.ts</code> with{" "}
              <code className="rounded bg-white px-1 py-0.5 text-[12px]">city: &quot;{city.id}&quot;</code> turns it on
              — the home header switches from &ldquo;we&apos;re not in {city.city} yet&rdquo; by itself.
            </>
          )}
        </p>

        {mine.length === 0 ? (
          <p className="text-sm text-stone-400">Nothing feeding {city.city} yet.</p>
        ) : (
          <ul className="space-y-2">
            {mine.map((s) => {
              const short = s.expectAtLeast != null && s.total > 0 && s.total < s.expectAtLeast;
              return (
                <li key={s.id} className="rounded-xl border border-stone-200 bg-white p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-semibold text-stone-900">{s.label}</p>
                      <p className="mt-0.5 truncate text-xs text-stone-500">
                        {s.category} · {s.pattern} · {s.id}
                      </p>
                    </div>
                    <a
                      href={s.site}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0 text-stone-400 transition hover:text-indigo-600"
                      aria-label={`Open ${s.label}`}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <Stat label="live" value={s.published} tone="emerald" />
                    {s.pending > 0 && <Stat label="held for review" value={s.pending} tone="amber" />}
                    <Stat label="total" value={s.total} tone="stone" />
                    {s.lastSeen && (
                      <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] text-stone-500">
                        last wrote {s.lastSeen}
                      </span>
                    )}
                    {!s.enabled && (
                      <span className="rounded-full bg-stone-200 px-2 py-0.5 text-[11px] font-medium text-stone-600">
                        disabled
                      </span>
                    )}
                  </div>

                  {short && (
                    <p className="mt-2 inline-flex items-center gap-1 text-[11px] text-amber-700">
                      <AlertTriangle className="h-3 w-3" />
                      holding {s.total}, below its baseline of {s.expectAtLeast} — the site may have changed
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );
  }

  // ── Cities grid ──────────────────────────────────────────────────────────
  return (
    <div>
      <h2 className="text-xl font-semibold tracking-tight text-stone-900">Sourcing</h2>
      <p className="mt-1 text-sm text-stone-500">
        A city is live when at least one source feeds it. Same rule the app uses.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {cities.map((c) => (
          <button
            key={c.id}
            onClick={() => open(c.id)}
            className="rounded-xl border border-stone-200 bg-white p-4 text-left transition hover:border-stone-300 hover:shadow-sm"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[15px] font-semibold text-stone-900">
                {c.emoji} {c.city}
              </span>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  c.live ? "bg-emerald-50 text-emerald-700" : "bg-stone-100 text-stone-500"
                }`}
              >
                {c.live ? "Live" : "Not live"}
              </span>
            </div>
            <p className="mt-1.5 flex items-center gap-1 text-xs text-stone-500">
              <MapPin className="h-3 w-3" />
              {c.sourceCount} source{c.sourceCount === 1 ? "" : "s"}
              {c.published > 0 && <> · {c.published} events live</>}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: "emerald" | "amber" | "stone" }) {
  const cls =
    tone === "emerald"
      ? "bg-emerald-50 text-emerald-700"
      : tone === "amber"
        ? "bg-amber-50 text-amber-800"
        : "bg-stone-100 text-stone-600";
  return (
    <span className={`rounded-full px-2 py-0.5 font-mono text-[11px] font-semibold ${cls}`}>
      {value} {label}
    </span>
  );
}
