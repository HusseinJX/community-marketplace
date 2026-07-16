"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Search, Sparkles, Loader2 } from "lucide-react";
import type { MatchCandidate } from "@/lib/types";
import { demoMatches } from "@/lib/demo-match";
import { track } from "@/lib/track";
import { MatchCard } from "./MatchCard";

type Mode = "for-you" | "search" | "similar";

// Shared semantic-match finder. Wraps the /api/vendor/match proxy so both the
// collaborator network and the organizer lineup discover people by MEANING
// (complementary fit, natural-language search, vector similarity) instead of a
// name-substring filter over a flat directory list.
//
// The parent owns selection + the invite action; this component owns discovery.
export function MatchFinder({
  memberId,
  isAdmin,
  similarSeed,
  placeholder = "Try “family-owned taco truck under $15” or “muralist for a mural”",
  selected,
  onToggle,
  sentIds,
  excludeIds,
  showForYou = true,
  searchable = true,
  defaultMode,
  demo = false,
  source = "unknown",
  mode: controlledMode,
  onModeChange,
  hideTabs = false,
}: {
  memberId: string;
  isAdmin: boolean;
  // When provided, adds a "Similar to {name}" tab seeded by this member.
  similarSeed?: { id: string; name: string };
  placeholder?: string;
  selected: Set<string>;
  onToggle: (c: MatchCandidate) => void;
  // Already-invited ids → shown as disabled "Invited".
  sentIds?: Set<string>;
  // Never show these (e.g. the acting member itself).
  excludeIds?: Set<string>;
  // "For you" (complementary-to-self) only makes sense when the searcher is
  // looking for their own partners — hide it for organizer lineup filling.
  showForYou?: boolean;
  // Hide natural-language Search (e.g. a compact/free teaser that only shows the
  // complementary "For you" matches). Defaults on.
  searchable?: boolean;
  defaultMode?: Mode;
  // Public/demo surfaces (e.g. /organizers) render the real UI on canned
  // candidates — no auth, and no paid engine call.
  demo?: boolean;
  // Where this finder lives — so the funnel can tell dashboard matches from
  // lineup-filling ones.
  source?: string;
  // Controlled mode — when a parent owns the For-you/Search tabs (e.g. so they
  // persist across a People/Events toggle). `hideTabs` then suppresses the
  // internal tab bar so the parent renders it once.
  mode?: Mode;
  onModeChange?: (m: Mode) => void;
  hideTabs?: boolean;
}) {
  const [internalMode, setInternalMode] = useState<Mode>(defaultMode ?? (showForYou ? "for-you" : "search"));
  const mode = controlledMode ?? internalMode;
  const setMode = (m: Mode) => {
    onModeChange?.(m);
    if (controlledMode === undefined) setInternalMode(m);
  };
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MatchCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reqId = useRef(0);

  const run = useCallback(
    async (body: Record<string, unknown>) => {
      const mine = ++reqId.current;
      setLoading(true);
      setError(null);
      if (demo) {
        const q = body.mode === "semantic" ? String(body.query ?? "") : undefined;
        setResults(demoMatches(q));
        setLoading(false);
        return;
      }
      try {
        const res = await fetch("/api/vendor/match", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...body, memberId: isAdmin ? memberId : undefined }),
        });
        const d = await res.json().catch(() => ({}));
        if (mine !== reqId.current) return; // stale response, ignore
        if (!res.ok && !Array.isArray(d.candidates)) {
          setError(d.error || "Couldn’t reach the matcher. Try again.");
          setResults([]);
          return;
        }
        const found: MatchCandidate[] = d.candidates ?? [];
        setResults(found);
        track("matches_shown", { count: found.length, mode: body.mode, source });
      } catch {
        if (mine !== reqId.current) return;
        setError("Couldn’t reach the matcher. Try again.");
        setResults([]);
      } finally {
        if (mine === reqId.current) setLoading(false);
      }
    },
    [isAdmin, memberId, demo, source],
  );

  // "For you" (complementary) and "Similar" load automatically on tab switch.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (mode === "for-you") run({ mode: "complementary" });
    else if (mode === "similar" && similarSeed) run({ mode: "similar", targetId: similarSeed.id });
    else setResults([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // Debounced natural-language search.
  useEffect(() => {
    if (mode !== "search") return;
    const q = query.trim();
    if (!q) {
      setResults([]);
      return;
    }
    const t = setTimeout(() => run({ mode: "semantic", query: q }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, mode]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const visible = results.filter((c) => !excludeIds?.has(c.id));

  const tabs: { key: Mode; label: string }[] = [
    ...(showForYou ? [{ key: "for-you" as Mode, label: "✨ For you" }] : []),
    ...(searchable ? [{ key: "search" as Mode, label: "🔎 Search" }] : []),
    ...(similarSeed ? [{ key: "similar" as Mode, label: `Similar to ${similarSeed.name}` }] : []),
  ];

  return (
    <div className="space-y-3">
      {/* Mode tabs (hidden when there's only one, or when a parent owns them) */}
      <div className={`flex-wrap gap-1.5 ${!hideTabs && tabs.length > 1 ? "flex" : "hidden"}`}>
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setMode(t.key)}
            className={`rounded-full px-3 py-1 text-sm font-medium transition ${
              mode === t.key ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {mode === "search" && (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-stone-400" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            className="w-full rounded-lg border border-stone-200 py-2 pl-9 pr-3 text-sm"
          />
        </div>
      )}

      {mode === "for-you" && (
        <p className="flex items-center gap-1.5 text-xs text-stone-400">
          <Sparkles className="h-3.5 w-3.5 text-teal-500" />
          Matched to what you offer and need — the closest fits first.
        </p>
      )}

      {/* Results */}
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-stone-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Finding matches…
        </div>
      ) : error ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-4 text-center text-sm text-amber-700">
          {error}
        </div>
      ) : visible.length === 0 ? (
        <p className="py-10 text-center text-sm text-stone-400">
          {mode === "search"
            ? query.trim()
              ? "No matches — try different words."
              : "Describe who you’re looking for."
            : "No recommendations yet. Try Search instead."}
        </p>
      ) : (
        <div className="space-y-2">
          {visible.map((c) => (
            <MatchCard
              key={c.id}
              candidate={c}
              selected={selected.has(c.id)}
              onToggle={() => onToggle(c)}
              disabled={sentIds?.has(c.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
