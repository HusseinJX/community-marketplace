"use client";

import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { createClient } from "@supabase/supabase-js";
import { Loader2, Send } from "lucide-react";
import { useSupportUnread } from "@/lib/data-hooks";
import type { SupportMessage } from "@/lib/support";
import type { SupportRealtimeConfig } from "@/lib/support-realtime";

const fetchSupportThread = (url: string) =>
  fetch(url, { cache: "no-store" }).then((response) => {
    if (!response.ok) throw new Error(`Request failed: ${response.status}`);
    return response.json();
  });

interface SupportThreadPayload {
  threadId: string | null;
  realtime: SupportRealtimeConfig | null;
  messages: SupportMessage[];
}

/**
 * The person's conversation with us.
 *
 * ⚠️ `data-private` on the transcript, and it is not decoration: PostHog
 * session replay runs at 100% and records the DOM verbatim. Every surface that
 * renders what a person SAID has to carry it (see CLAUDE.md → PostHog), and
 * this one holds the things people only say when they need help.
 *
 * Realtime when open, polling as fallback. The support tables stay private:
 * Supabase Broadcast only says "this thread changed", then this component
 * revalidates through /api/support, where Clerk auth still owns access.
 *
 * A FIXED BOX, not a long page: the page itself never scrolls, the transcript
 * scrolls inside it, and the composer sits at the bottom of the box where the
 * bottom nav starts. Same shape as the community rooms and the vendor inbox —
 * a sticky composer on a scrolling page ends up under the fixed bottom nav, and
 * a transcript that grows the page means the reader loses the input.
 */
export function SupportChat() {
  const { data, mutate, isLoading } = useSWR<SupportThreadPayload>(
    "/api/support",
    fetchSupportThread,
    {
      dedupingInterval: 0,
      refreshInterval: 15_000,
      revalidateOnFocus: true,
    },
  );
  const messages = data?.messages ?? [];

  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const { refresh: refreshBadge } = useSupportUnread();

  const latestStaffMessageId = [...messages].reverse().find((message) => message.sender === "staff")?.id;
  const realtimeUrl = data?.realtime?.url;
  const realtimeAnonKey = data?.realtime?.anonKey;
  const realtimeChannel = data?.realtime?.channel;

  useEffect(() => {
    if (!realtimeUrl || !realtimeAnonKey || !realtimeChannel) return;

    const supabase = createClient(realtimeUrl, realtimeAnonKey, {
      auth: { persistSession: false },
    });
    const channel = supabase
      .channel(realtimeChannel)
      .on("broadcast", { event: "message" }, () => {
        void mutate();
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [mutate, realtimeAnonKey, realtimeChannel, realtimeUrl]);

  // Opening the page IS reading it. If a staff reply lands while the chat is
  // already open, the polling render below shows it and this clears the badge
  // for that specific reply without needing to leave and come back.
  useEffect(() => {
    if (!data) return;
    void fetch("/api/support", { method: "PATCH" }).then(() => refreshBadge());
  }, [!!data, latestStaffMessageId, refreshBadge]);

  // Pin to the newest message. scrollTop on the SCROLLER, not scrollIntoView on
  // a sentinel: the sentinel lands a few pixels short of the bottom padding, so
  // the last bubble sat half-hidden behind the composer.
  useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  async function submit() {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || "Couldn't send");
      setDraft("");
      await mutate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send");
    } finally {
      setSending(false);
    }
  }

  return (
    // min-h-0 is load-bearing on the scroller below: a flex child defaults to
    // min-height:auto, which refuses to shrink under its content, so the
    // transcript would push the composer off the box instead of scrolling.
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={scrollerRef} data-private className="min-h-0 flex-1 space-y-3 overflow-y-auto py-2">
        {isLoading && messages.length === 0 && (
          <p className="text-sm text-stone-400">Loading…</p>
        )}

        {!isLoading && messages.length === 0 && (
          <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <p className="text-sm font-medium text-stone-800">Say hello 👋</p>
            <p className="mt-1 text-[13px] leading-relaxed text-stone-600">
              Ask us anything — an order that went wrong, something that looks broken, or an idea
              for what this should do next. A real person reads every message.
            </p>
          </div>
        )}

        {messages.map((m) => {
          const mine = m.sender === "user";
          return (
            <div key={m.id} className={mine ? "flex justify-end" : "flex justify-start"}>
              <div
                className={
                  "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[15px] leading-relaxed " +
                  (mine
                    ? "bg-stone-900 text-white"
                    : "border border-stone-200 bg-white text-stone-900")
                }
              >
                {!mine && (
                  <span className="mb-0.5 block text-[11px] font-semibold uppercase tracking-wide text-stone-400">
                    {m.author_name || "WhatsLocal"}
                  </span>
                )}
                <span className="whitespace-pre-line">{m.body}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* The floor of the box. Not sticky — the box doesn't scroll. */}
      <div className="shrink-0 border-t border-stone-200 bg-white/95 px-1 py-3 backdrop-blur">
        {error && <p className="mb-2 text-[12px] text-rose-600">{error}</p>}
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              // Enter sends, Shift+Enter breaks the line — the shape everyone
              // already has in their fingers.
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void submit();
              }
            }}
            rows={1}
            placeholder="Write a message…"
            data-private
            // 16px minimum or iOS zooms the page when the field takes focus.
            className="max-h-40 min-h-[46px] w-full resize-y rounded-2xl border border-stone-300 px-3.5 py-3 text-[16px] outline-none transition placeholder:text-stone-400 focus:border-stone-900"
          />
          <button
            onClick={submit}
            disabled={sending || !draft.trim()}
            aria-label="Send"
            className="inline-flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-full bg-stone-900 text-white transition hover:bg-stone-800 disabled:opacity-40"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
