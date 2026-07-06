"use client";

import { useState } from "react";
import { Sparkles, X, Loader2 } from "lucide-react";
import type { MatchCandidate, LineupSuggestion } from "@/lib/types";
import { roleDef } from "@/lib/lineup-roles";
import { MatchCard } from "@/components/match/MatchCard";

// Map a connector's free-text role ("Food & Beverage Vendor") to one of our
// LINEUP_ROLES keys so invites carry a sensible role badge.
function toLineupRole(text: string): string {
  const t = text.toLowerCase();
  if (/food|beverage|drink|restaurant|cater|taco|coffee|bakery/.test(t)) return "food";
  if (/perform|music|dj|band|dance|entertain|artist/.test(t)) return "performer";
  if (/sponsor|brand/.test(t)) return "sponsor";
  if (/volunteer|staff|helper/.test(t)) return "volunteer";
  if (/partner|organizer|host|influencer/.test(t)) return "partner";
  return "vendor";
}

// "Auto-fill this lineup" — the convener flow. Invents a lineup for the event
// from the local network (connector invent-event), shows per-role candidates
// with fit reasons, and bulk-invites the ones the organizer keeps.
export function AutoFillLineup({
  eventId,
  hint,
  memberId,
  isAdmin,
  invitedIds,
  onInvited,
}: {
  eventId: string;
  hint: string; // event title + description + city
  memberId: string;
  isAdmin: boolean;
  invitedIds: Set<string>;
  onInvited: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<LineupSuggestion | null>(null);
  // id → { candidate, role } for everything the organizer has checked.
  const [picked, setPicked] = useState<Map<string, { c: MatchCandidate; role: string }>>(new Map());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function run() {
    setOpen(true);
    setLoading(true);
    setError(null);
    setMsg("");
    setPicked(new Map());
    try {
      const res = await fetch("/api/vendor/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "lineup", hint, memberId: isAdmin ? memberId : undefined }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(d.error || "Couldn’t build a lineup. Try again.");
        return;
      }
      setSuggestion(d.suggestion ?? null);
    } catch {
      setError("Couldn’t build a lineup. Try again.");
    } finally {
      setLoading(false);
    }
  }

  function toggle(c: MatchCandidate, role: string) {
    setPicked((s) => {
      const n = new Map(s);
      if (n.has(c.id)) n.delete(c.id);
      else n.set(c.id, { c, role });
      return n;
    });
  }

  async function inviteAll() {
    if (picked.size === 0) return;
    setBusy(true);
    setMsg("");
    const invitees = [...picked.values()].map(({ c, role }) => ({
      id: c.id,
      name: c.name,
      role: toLineupRole(role),
    }));
    try {
      const res = await fetch(`/api/vendor/events/${eventId}/lineup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invitees, memberId: isAdmin ? memberId : undefined }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed");
      setMsg(`Invited ${d.invited} to the lineup.`);
      setPicked(new Map());
      onInvited();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed to invite");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        onClick={run}
        className="inline-flex items-center gap-1.5 rounded-lg border border-teal-300 bg-teal-50 px-3 py-2 text-sm font-medium text-teal-800 hover:bg-teal-100"
      >
        <Sparkles className="h-4 w-4" /> Auto-fill lineup
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2 border-b border-stone-100 px-4 py-3">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-stone-900">
                  <Sparkles className="h-4 w-4 text-teal-500" /> Suggested lineup
                </p>
                <p className="truncate text-xs text-stone-400">
                  Matched from your local network — pick who to invite.
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto p-4">
              {loading ? (
                <div className="flex items-center justify-center gap-2 py-16 text-sm text-stone-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Building a lineup from your network…
                </div>
              ) : error ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-4 text-center text-sm text-amber-700">
                  {error}
                  <button onClick={run} className="ml-2 font-medium underline">
                    Retry
                  </button>
                </div>
              ) : suggestion ? (
                <>
                  {suggestion.description && (
                    <p className="rounded-lg bg-stone-50 px-3 py-2 text-sm text-stone-600">
                      {suggestion.description}
                    </p>
                  )}
                  {suggestion.roles.length === 0 && (
                    <p className="py-10 text-center text-sm text-stone-400">
                      No candidates found in your network yet.
                    </p>
                  )}
                  {suggestion.roles.map((group) => {
                    const rd = roleDef(toLineupRole(group.role));
                    const fresh = group.candidates.filter((c) => !invitedIds.has(c.id));
                    if (fresh.length === 0) return null;
                    return (
                      <div key={group.role} className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                          {rd.emoji} {group.role}
                        </p>
                        {fresh.map((c) => (
                          <MatchCard
                            key={c.id}
                            candidate={c}
                            selected={picked.has(c.id)}
                            onToggle={() => toggle(c, group.role)}
                          />
                        ))}
                      </div>
                    );
                  })}
                </>
              ) : null}
            </div>

            {suggestion && (
              <div className="flex items-center justify-between gap-2 border-t border-stone-100 bg-white p-4">
                <span className="text-sm text-stone-500">
                  {msg || `${picked.size} selected`}
                </span>
                <button
                  onClick={inviteAll}
                  disabled={busy || picked.size === 0}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:bg-stone-200 disabled:text-stone-500"
                >
                  {busy ? "Inviting…" : `Invite ${picked.size || ""}`.trim()}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
