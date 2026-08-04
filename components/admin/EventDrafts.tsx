"use client";

// Review queue for scraped event drafts.
//
// These are the events parsed with hand-written selectors, held back because a
// silent mis-parse there produces plausible garbage rather than an error. The
// job on this screen is to read what the parser produced and say yes or no, so
// what it shows is the PARSED FIELDS — title, date, time, place — not a pretty
// card. A card that renders a mangled date beautifully is exactly the failure
// this queue exists to catch, so the source link is always one tap away.

import { useEffect, useState } from "react";
import { Check, X, ExternalLink, Loader2, CalendarClock, MapPin, Inbox } from "lucide-react";

interface Draft {
  id: string;
  title: string;
  description: string | null;
  date: string | null;
  endDate: string | null;
  time: string | null;
  location: string | null;
  image: string | null;
  url: string | null;
  sourceId: string | null;
  sourceLabel: string;
}

export function EventDrafts() {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Ids currently being decided, so their row can show progress and cannot be
  // double-submitted.
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [done, setDone] = useState<{ approved: number; rejected: number }>({ approved: 0, rejected: 0 });

  // Loading starts true, so the fetch never has to announce itself before
  // awaiting — every state write here lands after the round trip, which keeps
  // the effect from forcing a second render pass on mount.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const r = await fetch("/api/admin/event-drafts");
        const b = await r.json();
        if (cancelled) return;
        if (!r.ok) throw new Error(b.error ?? "Could not load drafts");
        setDrafts(b.drafts ?? []);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load drafts");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const decide = async (ids: string[], approve: boolean) => {
    setBusy((s) => new Set([...s, ...ids]));
    try {
      const r = await fetch("/api/admin/event-drafts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, approve }),
      });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error ?? "Could not save");
      // Drop them locally rather than refetching — the decision is recorded and
      // a round-trip would just repaint the same list minus these rows.
      setDrafts((d) => d.filter((x) => !ids.includes(x.id)));
      setDone((p) =>
        approve
          ? { ...p, approved: p.approved + (b.decided ?? ids.length) }
          : { ...p, rejected: p.rejected + (b.decided ?? ids.length) },
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy((s) => {
        const n = new Set(s);
        for (const id of ids) n.delete(id);
        return n;
      });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-stone-400" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-stone-900">
            Scraped drafts
          </h2>
          <p className="text-sm text-stone-500">
            Held back for a human because this source is parsed with hand-written
            selectors. Approving puts an event in the feed; rejecting keeps it out
            for good, including after future scrapes.
          </p>
        </div>
        {drafts.length > 0 && (
          <span className="shrink-0 rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-800">
            {drafts.length} waiting
          </span>
        )}
      </div>

      {(done.approved > 0 || done.rejected > 0) && (
        <p className="mb-4 text-sm text-stone-500">
          {done.approved > 0 && <>Published {done.approved}. </>}
          {done.rejected > 0 && <>Rejected {done.rejected}.</>}
        </p>
      )}

      {error && (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {drafts.length === 0 ? (
        <div className="rounded-2xl border border-stone-200 bg-white py-16 text-center">
          <Inbox className="mx-auto h-6 w-6 text-stone-300" />
          <p className="mt-3 text-sm font-medium text-stone-700">Nothing waiting</p>
          <p className="mt-1 text-xs text-stone-500">
            Every scraped draft has been ruled on.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {drafts.map((d) => {
            const working = busy.has(d.id);
            return (
              <li
                key={d.id}
                className={`rounded-2xl border border-stone-200 bg-white p-4 transition ${working ? "opacity-50" : ""}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="text-[15px] font-semibold text-stone-900">{d.title}</h3>

                    {/* The parsed fields, stated plainly. A missing one shows as
                        "not found" rather than vanishing — an absent date is the
                        single most common sign of a bad parse, and a card that
                        just omits it hides exactly what needs catching. */}
                    <dl className="mt-2 space-y-1 text-xs text-stone-600">
                      <div className="flex items-start gap-1.5">
                        <CalendarClock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-stone-400" />
                        {/* An end date is shown whenever there is one. Without
                            it a still-running exhibition reads as its OPENING
                            day — a March date on an August screen looks exactly
                            like the mis-parse this queue exists to catch, and a
                            reviewer would reject something perfectly good. */}
                        <dd>
                          {d.date ?? <span className="text-rose-600">no date found</span>}
                          {d.endDate && d.endDate !== d.date ? ` → ${d.endDate}` : ""}
                          {d.time ? ` · ${d.time}` : ""}
                          {d.endDate && d.endDate !== d.date && (
                            <span className="ml-1.5 rounded bg-stone-100 px-1.5 py-0.5 text-[10px] font-medium text-stone-500">
                              runs to
                            </span>
                          )}
                        </dd>
                      </div>
                      <div className="flex items-start gap-1.5">
                        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-stone-400" />
                        <dd>
                          {d.location ?? <span className="text-stone-400">no place found</span>}
                        </dd>
                      </div>
                    </dl>

                    {d.description && (
                      <p className="mt-2 line-clamp-3 text-xs text-stone-500">{d.description}</p>
                    )}

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-600">
                        {d.sourceLabel}
                      </span>
                      {d.url && (
                        <a
                          href={d.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-700 hover:underline"
                        >
                          Check the source <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </div>

                  {d.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={d.image}
                      alt=""
                      className="h-20 w-20 shrink-0 rounded-lg object-cover"
                    />
                  )}
                </div>

                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    disabled={working}
                    onClick={() => void decide([d.id], true)}
                    className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-1.5 text-[13px] font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                  >
                    <Check className="h-3.5 w-3.5" /> Publish
                  </button>
                  <button
                    type="button"
                    disabled={working}
                    onClick={() => void decide([d.id], false)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-stone-300 px-4 py-1.5 text-[13px] font-semibold text-stone-600 transition hover:border-stone-400 hover:bg-stone-50 disabled:opacity-50"
                  >
                    <X className="h-3.5 w-3.5" /> Reject
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
