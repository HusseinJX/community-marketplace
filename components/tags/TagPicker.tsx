"use client";

import { useEffect, useState } from "react";
import { Loader2, MapPin, Plus, Tag as TagIcon, X } from "lucide-react";

export interface PickedTag {
  id: string;
  label: string;
  kind: string;
}

const KINDS = [
  { kind: "market", label: "Market", hint: "A recurring trading spot" },
  { kind: "venue", label: "Venue", hint: "A place you can stand in" },
  { kind: "festival", label: "Festival", hint: "Bounded — give it dates" },
  { kind: "district", label: "District", hint: "A neighbourhood or strip" },
  { kind: "brand", label: "Brand", hint: "What several locations share" },
];

/**
 * Pick the tags a business belongs to, creating one if it isn't here yet.
 *
 * The kind matters at creation time and only then: it decides whether the
 * thing is bounded (a festival has dates; a market does not). After that a tag
 * is just a tag.
 */
export function TagPicker({
  value,
  onChange,
  /** Pre-fills a new tag's coordinates — you are standing in the place. */
  coords,
}: {
  value: PickedTag[];
  onChange: (next: PickedTag[]) => void;
  coords?: { lat: number; lng: number } | null;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PickedTag[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [kind, setKind] = useState("market");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 1) {
      setResults(null);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/tags?q=${encodeURIComponent(q)}`);
        const d = await res.json();
        setResults(
          (d.tags ?? []).map((t: { id: string; label: string; kind: string }) => ({
            id: t.id,
            label: t.label,
            kind: t.kind,
          })),
        );
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  const add = (t: PickedTag) => {
    if (!value.some((x) => x.id === t.id)) onChange([...value, t]);
    setQuery("");
    setResults(null);
    setShowCreate(false);
    setStartsAt("");
    setEndsAt("");
  };

  async function create() {
    setCreating(true);
    try {
      const res = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: query.trim(),
          kind,
          // Dates belong to the TAG only when the thing itself is bounded —
          // which is what choosing "festival" means.
          startsAt: kind === "festival" && startsAt ? new Date(startsAt).toISOString() : null,
          endsAt: kind === "festival" && endsAt ? new Date(endsAt).toISOString() : null,
          lat: coords?.lat ?? null,
          lng: coords?.lng ?? null,
        }),
      });
      const d = await res.json();
      if (d.tagId) add({ id: d.tagId, label: d.tag?.label ?? query.trim(), kind: d.tag?.kind ?? kind });
    } finally {
      setCreating(false);
    }
  }

  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-stone-600">
        Tags — where they are, what they&apos;re part of
      </label>

      {value.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {value.map((t) => (
            <span
              key={t.id}
              className="inline-flex items-center gap-1 rounded-full bg-emerald-50 py-1 pl-2.5 pr-1 text-xs font-semibold text-emerald-800"
            >
              <TagIcon className="h-3 w-3" />
              {t.label}
              <button
                onClick={() => onChange(value.filter((x) => x.id !== t.id))}
                aria-label={`Remove ${t.label}`}
                className="rounded-full p-0.5 hover:bg-emerald-100"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="relative">
        <TagIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowCreate(false);
          }}
          placeholder="Ferry Plaza Farmers Market, Oracle Park…"
          className="w-full rounded-xl border border-stone-200 py-2 pl-9 pr-3 text-sm text-stone-900 placeholder-stone-400 focus:outline-none"
        />
        {searching && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-stone-400" />
        )}
      </div>

      {results !== null && query.trim().length >= 1 && (
        <div className="mt-2 overflow-hidden rounded-xl border border-stone-200">
          {results.map((t) => (
            <button
              key={t.id}
              onClick={() => add(t)}
              className="flex w-full items-center justify-between gap-2 border-b border-stone-100 px-3 py-2 text-left last:border-0 hover:bg-stone-50"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-stone-900">{t.label}</span>
                <span className="text-xs capitalize text-stone-500">{t.kind}</span>
              </span>
              <Plus className="h-4 w-4 shrink-0 text-stone-400" />
            </button>
          ))}
          <button
            onClick={() => setShowCreate(true)}
            className="flex w-full items-center gap-2 bg-stone-50 px-3 py-2 text-left text-sm font-semibold text-emerald-700 hover:bg-stone-100"
          >
            <Plus className="h-4 w-4" />
            New tag &ldquo;{query.trim()}&rdquo;
          </button>
        </div>
      )}

      {showCreate && (
        <div className="mt-2 space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/40 p-3">
          <p className="text-sm font-semibold text-stone-900">New tag: {query.trim()}</p>

          <div className="flex flex-wrap gap-1.5">
            {KINDS.map((k) => (
              <button
                key={k.kind}
                onClick={() => setKind(k.kind)}
                title={k.hint}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  kind === k.kind
                    ? "bg-stone-900 text-white"
                    : "bg-white text-stone-600 hover:bg-stone-100"
                }`}
              >
                {k.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-stone-500">{KINDS.find((k) => k.kind === kind)?.hint}</p>

          {/* Dates only for a festival — the one kind where the THING is
              bounded. A market has no end date; the vendor's Saturdays are a
              fact about that vendor, not about the market. */}
          {kind === "festival" && (
            <div className="flex gap-2">
              <input
                type="date"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className="flex-1 rounded-lg border border-stone-200 bg-white px-2 py-1.5 text-xs"
              />
              <input
                type="date"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                className="flex-1 rounded-lg border border-stone-200 bg-white px-2 py-1.5 text-xs"
              />
            </div>
          )}

          {coords && (
            <p className="inline-flex items-center gap-1 text-xs text-stone-500">
              <MapPin className="h-3 w-3" /> Pinned where you are now
            </p>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => void create()}
              disabled={creating}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-stone-950 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
            >
              {creating && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Create and apply
            </button>
            <button
              onClick={() => setShowCreate(false)}
              className="rounded-full border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-600"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
