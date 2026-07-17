"use client";

import { Check, MapPin } from "lucide-react";
import type { MatchCandidate } from "@/lib/types";

const TYPE_EMOJI: Record<string, string> = {
  vendor: "🛍️",
  artist: "🎨",
  organizer: "📋",
  shopper: "🙋",
  influencer: "📣",
};

// One match result — name, type, place, the "why matched" breadcrumbs, and a
// select toggle. Shared across the network + organize finders.
export function MatchCard({
  candidate,
  selected,
  onToggle,
  disabled,
  disabledLabel = "Invited",
  justSelected = false,
  justUnselected = false,
}: {
  candidate: MatchCandidate;
  selected: boolean;
  onToggle: () => void;
  disabled?: boolean;
  disabledLabel?: string;
  /** Just picked — pops the checkmark so the selection registers before the
   *  row animates away. */
  justSelected?: boolean;
  /** Just dropped — the mirror: the checkmark shrinks out as the row leaves. */
  justUnselected?: boolean;
}) {
  const c = candidate;
  const place = c.neighborhood || c.city;
  const distance =
    typeof c.distanceMi === "number" ? `${c.distanceMi < 10 ? c.distanceMi.toFixed(1) : Math.round(c.distanceMi)} mi` : null;
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onToggle}
      disabled={disabled}
      className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition ${
        disabled
          ? "cursor-default border-stone-100 bg-stone-50 opacity-70"
          : selected
            ? "border-teal-500 bg-teal-50/60 ring-1 ring-teal-500"
            : "border-stone-200 bg-white hover:border-stone-300"
      }`}
    >
      <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-stone-100 text-lg">
        {TYPE_EMOJI[c.memberType ?? ""] ?? "📍"}
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-stone-900">{c.name}</span>
          {c.memberType && (
            <span className="shrink-0 rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-medium capitalize text-stone-500">
              {c.memberType}
            </span>
          )}
        </span>

        {(place || distance) && (
          <span className="mt-0.5 flex items-center gap-1.5 text-xs text-stone-400">
            {place && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {place}
              </span>
            )}
            {distance && (
              <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-medium text-stone-500">
                {distance}
              </span>
            )}
          </span>
        )}

        {/* Why matched — the trust-builder */}
        {c.reasons.length > 0 && (
          <span className="mt-1.5 flex flex-wrap gap-1">
            {c.reasons.slice(0, 3).map((r, i) => (
              <span
                key={i}
                className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700"
              >
                {r}
              </span>
            ))}
          </span>
        )}
      </span>

      <span
        className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border text-white ${
          justSelected ? "animate-check-pop " : justUnselected ? "animate-check-unpop " : ""
        }${
          disabled
            ? "border-stone-300 bg-stone-300"
            : selected
              ? "border-teal-500 bg-teal-500"
              : "border-stone-300 bg-transparent"
        }`}
        aria-hidden
      >
        {(selected || disabled) && <Check className="h-3.5 w-3.5" />}
      </span>
      {disabled && <span className="sr-only">{disabledLabel}</span>}
    </button>
  );
}
