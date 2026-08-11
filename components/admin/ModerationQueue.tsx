"use client";

// The moderator's screen — App Store 1.2 requires reports be acted on within
// 24h, and the AI screener now generates a second stream of work beside them.
//
// Both streams are shown, and shown SEPARATELY. A report is a person saying
// "this is wrong"; a screening event is a model saying "I'm not sure". They
// need different scepticism from whoever is working the queue, and merging them
// into one list would quietly launder the second into the first.
//
// The AI stream shows the scores that caused the decision. Without them the
// only way to tune a threshold is to guess, and the only answer to "why was my
// post hidden?" is a shrug.

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { Check, X, Loader2, Inbox, ShieldAlert, Bot, Flag, MessageSquare } from "lucide-react";

interface Report {
  id: string;
  post_id: string;
  reporter_id: string;
  author_id: string | null;
  reason: string;
  note: string | null;
  created_at: string;
}

interface Screened {
  id: string;
  surface: string;
  content_id: string | null;
  author_id: string | null;
  action: string;
  categories: string[];
  scores: Record<string, number> | null;
  excerpt: string | null;
  image_count: number;
  flagged_images: boolean;
  created_at: string;
  post: { body: string | null; image_urls: string[]; author_name: string | null } | null;
}

export function ModerationQueue() {
  const [reports, setReports] = useState<Report[]>([]);
  const [screened, setScreened] = useState<Screened[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Set<string>>(new Set());

  const load = useCallback(async (signal?: { cancelled: boolean }) => {
    try {
      const r = await fetch("/api/admin/moderation");
      const b = await r.json();
      if (signal?.cancelled) return;
      if (!r.ok) throw new Error(b.error ?? "Could not load the queue");
      setReports(b.reports ?? []);
      setScreened(b.screened ?? []);
      setError(null);
    } catch (e) {
      if (signal?.cancelled) return;
      setError(e instanceof Error ? e.message : "Could not load the queue");
    } finally {
      if (!signal?.cancelled) setLoading(false);
    }
  }, []);

  // Every state write lands after the await, so the mount fetch never forces a
  // second synchronous render pass (same shape as EventDrafts).
  useEffect(() => {
    const signal = { cancelled: false };
    void (async () => {
      await load(signal);
    })();
    return () => {
      signal.cancelled = true;
    };
  }, [load]);

  const act = async (rowKey: string, body: Record<string, unknown>) => {
    setBusy((s) => new Set([...s, rowKey]));
    try {
      const r = await fetch("/api/admin/moderation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "Action failed");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy((s) => {
        const next = new Set(s);
        next.delete(rowKey);
        return next;
      });
    }
  };

  if (loading) {
    return (
      <p className="flex items-center gap-2 py-10 text-sm text-stone-400">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading the queue…
      </p>
    );
  }

  const nothing = reports.length === 0 && screened.length === 0;

  return (
    <div className="space-y-8">
      {error && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
      )}

      {nothing && (
        <div className="flex flex-col items-center gap-2 py-14 text-center">
          <Inbox className="h-8 w-8 text-stone-300" />
          <p className="text-sm text-stone-500">Nothing waiting. Reports and held content land here.</p>
        </div>
      )}

      {screened.length > 0 && (
        <section>
          <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-stone-500">
            <Bot className="h-4 w-4 text-indigo-500" /> Held by the screener
            <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-500">
              {screened.length}
            </span>
          </h2>
          <p className="mb-3 text-xs text-stone-400">
            A model was unsure. Held posts are hidden from every feed until you decide; flagged chat
            messages were delivered.
          </p>
          <div className="space-y-3">
            {screened.map((s) => (
              <ScreenedRow key={s.id} s={s} busy={busy.has(s.id)} act={act} />
            ))}
          </div>
        </section>
      )}

      {reports.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-stone-500">
            <Flag className="h-4 w-4 text-rose-500" /> Reported by members
            <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-500">
              {reports.length}
            </span>
          </h2>
          <div className="space-y-3">
            {reports.map((r) => (
              <div key={r.id} className="rounded-xl border border-stone-200 bg-white p-4">
                <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500">
                  <span className="rounded-full bg-rose-50 px-2 py-0.5 font-medium text-rose-700">
                    {r.reason}
                  </span>
                  <span>· post {r.post_id.slice(0, 8)}</span>
                  <span>· {new Date(r.created_at).toLocaleString()}</span>
                </div>
                {r.note && <p className="mt-2 text-sm text-stone-700">“{r.note}”</p>}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Action
                    label="Remove post"
                    tone="danger"
                    busy={busy.has(r.id)}
                    onClick={() => act(r.id, { action: "remove", postId: r.post_id })}
                  />
                  <Action
                    label="Dismiss"
                    busy={busy.has(r.id)}
                    onClick={() => act(r.id, { action: "restore", postId: r.post_id })}
                  />
                  {r.author_id && (
                    <Action
                      label="Ban author"
                      tone="danger"
                      busy={busy.has(r.id)}
                      onClick={() => act(r.id, { action: "ban", authorId: r.author_id, reason: r.reason })}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function ScreenedRow({
  s,
  busy,
  act,
}: {
  s: Screened;
  busy: boolean;
  act: (rowKey: string, body: Record<string, unknown>) => Promise<void>;
}) {
  const top = Object.entries(s.scores ?? {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);
  const isChat = s.surface === "chat";
  const heldPost = !isChat && !!s.content_id;
  const text = s.post?.body ?? s.excerpt;

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500">
        <span
          className={
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium " +
            (s.action === "block" ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700")
          }
        >
          {s.action === "block" ? <ShieldAlert className="h-3 w-3" /> : <Bot className="h-3 w-3" />}
          {s.action === "block" ? "Blocked" : "Held"}
        </span>
        <span className="inline-flex items-center gap-1">
          {isChat ? <MessageSquare className="h-3 w-3" /> : null}
          {isChat ? "chat message" : "post"}
        </span>
        {s.categories.length > 0 && <span>· {s.categories.join(", ")}</span>}
        {s.flagged_images && (
          <span className="rounded-full bg-stone-900 px-2 py-0.5 font-medium text-white">image flagged</span>
        )}
        <span>· {new Date(s.created_at).toLocaleString()}</span>
      </div>

      {text && <p className="mt-2 whitespace-pre-wrap text-sm text-stone-800">{text}</p>}

      {s.post?.image_urls?.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {s.post.image_urls.map((url) => (
            <div key={url} className="relative h-24 w-24 overflow-hidden rounded-lg bg-stone-100">
              <Image src={url} alt="" fill sizes="96px" className="object-cover" />
            </div>
          ))}
        </div>
      ) : s.image_count > 0 ? (
        // A blocked post was never written, so there is nothing to fetch — say
        // so rather than implying it had no images.
        <p className="mt-2 text-xs text-stone-400">
          {s.image_count} image{s.image_count === 1 ? "" : "s"} — not stored (the write was blocked)
        </p>
      ) : null}

      {top.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {top.map(([k, v]) => (
            <span
              key={k}
              className="rounded-md bg-stone-100 px-1.5 py-0.5 font-mono text-[11px] text-stone-600"
            >
              {k} {v.toFixed(2)}
            </span>
          ))}
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {heldPost ? (
          <>
            <Action
              label="Publish it"
              tone="ok"
              busy={busy}
              onClick={() => act(s.id, { action: "clear", postId: s.content_id })}
            />
            <Action
              label="Keep hidden"
              tone="danger"
              busy={busy}
              onClick={() => act(s.id, { action: "uphold", postId: s.content_id })}
            />
          </>
        ) : (
          <>
            <Action
              label="Agree"
              tone="danger"
              busy={busy}
              onClick={() => act(s.id, { action: "resolve", eventId: s.id, status: "actioned" })}
            />
            <Action
              label="False positive"
              tone="ok"
              busy={busy}
              onClick={() => act(s.id, { action: "resolve", eventId: s.id, status: "dismissed" })}
            />
          </>
        )}
        {s.author_id && (
          <Action
            label="Ban author"
            tone="danger"
            busy={busy}
            onClick={() => act(s.id, { action: "ban", authorId: s.author_id, reason: s.categories.join(", ") })}
          />
        )}
      </div>
    </div>
  );
}

function Action({
  label,
  onClick,
  busy,
  tone = "neutral",
}: {
  label: string;
  onClick: () => void;
  busy: boolean;
  tone?: "neutral" | "ok" | "danger";
}) {
  const styles =
    tone === "danger"
      ? "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
      : tone === "ok"
        ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
        : "border-stone-200 bg-white text-stone-700 hover:bg-stone-50";
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition disabled:opacity-50 ${styles}`}
    >
      {busy ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : tone === "ok" ? (
        <Check className="h-3.5 w-3.5" />
      ) : (
        <X className="h-3.5 w-3.5" />
      )}
      {label}
    </button>
  );
}
