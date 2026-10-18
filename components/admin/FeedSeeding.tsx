"use client";

// Super-admin → Feed. The controls for seeded feed content
// (features/community-feed-seeding.md, lib/feed-items.ts):
//
//   WhatsLocal items — a few hand-picked event posts (lib/feed-items.ts
//   postRecapsFor). Shown in the feed as WhatsLocal, below every real post.
//   Pause hides them all at once, no deploy.
//
//   Drafts for you — AI-written pointers to upcoming events. Nothing is posted
//   until you edit one and press "Post as me"; it then goes out under YOUR
//   account as a normal post. Skip drops it for good.

import { useCallback, useEffect, useState } from "react";
import { Loader2, Sparkles, Pause, Play, Send, X, Inbox, CalendarClock, MapPin } from "lucide-react";

interface Draft {
  id: string;
  title: string | null;
  body: string;
  image_url: string | null;
  link_url: string | null;
  event_date: string | null;
  venue: string | null;
}

interface Status {
  paused: boolean;
  liveNow: number;
  scheduled: number;
  drafts: Draft[];
}

export function FeedSeeding() {
  const [status, setStatus] = useState<Status | null>(null);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/feed");
      const b = await r.json();
      if (!r.ok) throw new Error(b.error ?? "Could not load");
      setStatus(b);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function call(method: "POST" | "PATCH", body: object, key: string) {
    setBusy(key);
    setError(null);
    setNote(null);
    try {
      const r = await fetch("/api/admin/feed", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error ?? "Failed");
      return b;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function generate() {
    const b = await call("POST", { action: "generate", drafts: 6 }, "generate");
    if (b?.written) {
      const w = b.written as { drafts: number };
      // Counted from what LANDED, not what was asked for.
      setNote(`Added ${w.drafts} draft${w.drafts === 1 ? "" : "s"}.`);
      await load();
    }
  }

  async function togglePause() {
    if (!status) return;
    const b = await call("POST", { action: status.paused ? "resume" : "pause" }, "pause");
    if (b) await load();
  }

  async function decide(d: Draft, action: "post" | "skip") {
    const b = await call("PATCH", { id: d.id, action, body: edits[d.id] ?? d.body }, d.id);
    if (!b) return;
    if (action === "post") setNote(b.held ? "Posted — held for review by the screener." : "Posted to the feed as you.");
    setStatus((s) => (s ? { ...s, drafts: s.drafts.filter((x) => x.id !== d.id) } : s));
  }

  if (!status && !error) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-stone-400" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section>
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-stone-900">WhatsLocal in the feed</h2>
            <p className="text-sm text-stone-500">
              A few hand-picked event posts, shown as WhatsLocal below every real post — one fewer for each real post.
              They stay until you pause them. Pause hides them all.
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              onClick={generate}
              disabled={!!busy}
              className="inline-flex items-center gap-1.5 rounded-full bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-50"
            >
              {busy === "generate" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Write drafts
            </button>
            {status && (
              <button
                onClick={togglePause}
                disabled={!!busy}
                className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium disabled:opacity-50 ${
                  status.paused
                    ? "bg-emerald-600 text-white hover:bg-emerald-700"
                    : "border border-stone-200 bg-white text-stone-700 hover:border-stone-300"
                }`}
              >
                {status.paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                {status.paused ? "Resume" : "Pause all"}
              </button>
            )}
          </div>
        </div>

        {status && (
          <div className="grid grid-cols-2 gap-3">
            <Stat label="In the feed now" value={status.paused ? "Paused" : String(status.liveNow)} />
            <Stat label="Drafts waiting" value={String(status.drafts.length)} />
          </div>
        )}
      </section>

      {note && <p className="text-sm text-emerald-700">{note}</p>}
      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}

      <section>
        <div className="mb-3">
          <h2 className="text-lg font-semibold tracking-tight text-stone-900">Drafts for you</h2>
          <p className="text-sm text-stone-500">
            Pointers to upcoming events, written for you to edit. <strong>Post as me</strong> publishes it under your own
            account as a normal post, tagged to the event. Make it yours — it shouldn&apos;t say you went somewhere you
            didn&apos;t.
          </p>
        </div>

        {!status || status.drafts.length === 0 ? (
          <div className="rounded-2xl border border-stone-200 bg-white py-12 text-center">
            <Inbox className="mx-auto h-6 w-6 text-stone-300" />
            <p className="mt-3 text-sm font-medium text-stone-700">No drafts waiting</p>
            <p className="mt-1 text-xs text-stone-500">Write drafts adds up to 6 for events in the next ten days.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {status.drafts.map((d) => (
              <div key={d.id} className="rounded-2xl border border-stone-200 bg-white p-4">
                <div className="flex gap-3">
                  {d.image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={d.image_url} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover ring-1 ring-stone-200" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-stone-900">{d.title}</p>
                    <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-stone-500">
                      {d.event_date && (
                        <span className="inline-flex items-center gap-1">
                          <CalendarClock className="h-3 w-3" />
                          {d.event_date}
                        </span>
                      )}
                      {d.venue && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {d.venue}
                        </span>
                      )}
                      {d.link_url && (
                        <a href={d.link_url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
                          Source
                        </a>
                      )}
                    </div>
                  </div>
                </div>
                <textarea
                  value={edits[d.id] ?? d.body}
                  onChange={(e) => setEdits((m) => ({ ...m, [d.id]: e.target.value }))}
                  rows={3}
                  className="mt-3 w-full resize-y rounded-xl border border-stone-200 px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-stone-300"
                />
                <div className="mt-2 flex justify-end gap-2">
                  <button
                    onClick={() => decide(d, "skip")}
                    disabled={!!busy}
                    className="inline-flex items-center gap-1 rounded-full border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600 hover:border-stone-300 disabled:opacity-50"
                  >
                    <X className="h-3.5 w-3.5" /> Skip
                  </button>
                  <button
                    onClick={() => decide(d, "post")}
                    disabled={!!busy}
                    className="inline-flex items-center gap-1 rounded-full bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {busy === d.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                    Post as me
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-3">
      <p className="text-xs text-stone-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-stone-900">{value}</p>
    </div>
  );
}
