"use client";

import { useState } from "react";
import Link from "next/link";
import { Link2, Loader2, CalendarPlus, X, Check, MapPin, Clock } from "lucide-react";

type Draft = {
  title: string;
  description: string | null;
  event_date: string | null;
  event_time: string | null;
  location: string | null;
  source_url: string;
};

// Paste an event link → AI reads the page → preview → add it to THIS vendor's
// events. Sits above the Collabs card on the vendor dashboard.
export function EventLinkImport({
  memberId,
  memberName,
  isAdmin,
}: {
  memberId: string;
  memberName?: string;
  isAdmin?: boolean;
}) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<{ id?: string } | null>(null);

  async function extract() {
    const link = url.trim();
    if (!link) return;
    setError(null);
    setAdded(null);
    setBusy("Reading the link…");
    try {
      const res = await fetch("/api/vendor/events/from-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: link, memberId, isAdmin }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Could not read that link.");
      setDraft(d.event);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  async function add() {
    if (!draft) return;
    setBusy("Adding…");
    setError(null);
    try {
      const res = await fetch(`/api/events/${memberId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, active: true, source: "link", memberName }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Could not add the event.");
      setAdded({ id: d.created?.[0]?.id });
      setDraft(null);
      setUrl("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="card-soft p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-stone-900">
        <Link2 className="h-4 w-4 text-indigo-500" /> Add an event from a link
      </p>
      <p className="mt-0.5 text-xs text-stone-500">
        Paste an event page (Eventbrite, a flyer post, a venue page) and I&apos;ll pull the details.
      </p>

      <div className="mt-3 flex gap-2">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !busy && extract()}
          placeholder="https://…"
          inputMode="url"
          className="min-w-0 flex-1 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
        />
        <button
          onClick={extract}
          disabled={!!busy || !url.trim()}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-stone-900 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-stone-800 disabled:opacity-50"
        >
          {busy === "Reading the link…" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarPlus className="h-4 w-4" />}
          Get event
        </button>
      </div>

      {error && <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}

      {draft && (
        <div className="mt-3 rounded-xl border border-indigo-100 bg-indigo-50/50 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-indigo-500">This looks like an event</p>
          <p className="mt-1 text-sm font-bold text-stone-900">{draft.title}</p>
          <div className="mt-1 space-y-0.5 text-xs text-stone-600">
            {(draft.event_date || draft.event_time) && (
              <p className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-stone-400" /> {[draft.event_date, draft.event_time].filter(Boolean).join(" · ")}
              </p>
            )}
            {draft.location && (
              <p className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-stone-400" /> {draft.location}
              </p>
            )}
          </div>
          {draft.description && <p className="mt-1.5 line-clamp-3 text-xs text-stone-500">{draft.description}</p>}

          <div className="mt-3 flex gap-2">
            <button
              onClick={add}
              disabled={!!busy}
              className="inline-flex items-center gap-1.5 rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
            >
              {busy === "Adding…" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Add to my events
            </button>
            <button
              onClick={() => setDraft(null)}
              className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-600 transition hover:bg-stone-50"
            >
              <X className="h-4 w-4" /> Discard
            </button>
          </div>
        </div>
      )}

      {added && (
        <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5">
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-800">
            <Check className="h-4 w-4" /> Added to your events
          </span>
          {added.id && (
            <Link href={`/events/${added.id}`} target="_blank" className="shrink-0 text-xs font-semibold text-emerald-700 hover:underline">
              View →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
