"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { ArrowLeft, Loader2, Send, Store } from "lucide-react";
import Link from "next/link";
import type { SupportMessage, SupportThread } from "@/lib/support";

/**
 * Our side of support chat: who is waiting, and the conversation with them.
 *
 * Master–detail, like everything else in this app — the list of people becomes
 * the person's name with a back link. Threads we owe a reply to sort to the
 * top (see lib/support listThreads); a support inbox ordered purely by time
 * buries the person still waiting under everyone we already answered.
 *
 * ⚠️ `data-private` on every transcript — PostHog replay is on at 100% and this
 * screen renders what other people told us in confidence.
 */
export function SupportInbox() {
  const { data, mutate } = useSWR<{ threads: SupportThread[] }>("/api/support/threads", {
    refreshInterval: 20_000,
  });
  const threads = data?.threads ?? [];
  const [openId, setOpenId] = useState<string | null>(null);
  const open = threads.find((t) => t.id === openId) ?? null;

  if (open) {
    return (
      <SupportThreadView
        thread={open}
        onBack={() => {
          setOpenId(null);
          void mutate();
        }}
        onChanged={() => mutate()}
      />
    );
  }

  return (
    <div className="space-y-2">
      {!data && <p className="text-sm text-stone-500">Loading…</p>}
      {data && threads.length === 0 && (
        <p className="text-sm text-stone-400">
          Nobody has written yet. The card sits on top of every home tab for signed-in people.
        </p>
      )}

      {threads.map((t) => (
        <button
          key={t.id}
          onClick={() => setOpenId(t.id)}
          className="flex w-full items-start gap-3 rounded-xl border border-stone-200 bg-white p-3 text-left transition hover:border-stone-300"
        >
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span className="truncate text-sm font-semibold text-stone-900">
                {t.display_name || t.email || "Someone"}
              </span>
              {t.staff_unread > 0 && (
                <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-rose-600 px-1 text-[11px] font-bold leading-none text-white">
                  {t.staff_unread}
                </span>
              )}
            </span>
            <span data-private className="mt-0.5 block truncate text-[13px] text-stone-500">
              {t.last_sender === "staff" ? "You: " : ""}
              {t.preview}
            </span>
            <span className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-stone-400">
              {t.email && <span className="truncate">{t.email}</span>}
              {t.member_id && (
                <span className="inline-flex items-center gap-1">
                  <Store className="h-3 w-3" /> vendor
                </span>
              )}
              {t.last_message_at && <span>{new Date(t.last_message_at).toLocaleString()}</span>}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}

function SupportThreadView({
  thread,
  onBack,
  onChanged,
}: {
  thread: SupportThread;
  onBack: () => void;
  onChanged: () => void;
}) {
  const { data, mutate } = useSWR<{ messages: SupportMessage[] }>(
    `/api/support/threads/${thread.id}`,
    { refreshInterval: 10_000 },
  );
  const messages = data?.messages ?? [];
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  // Opening it is reading it — clear OUR badge only. Whether they have read our
  // reply is their counter, and support marking itself read on their behalf is
  // how a person stops trusting the dot.
  const markRead = useCallback(async () => {
    await fetch(`/api/support/threads/${thread.id}`, { method: "PATCH" });
    onChanged();
  }, [thread.id, onChanged]);

  useEffect(() => {
    void markRead();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread.id]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  async function reply() {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      await fetch(`/api/support/threads/${thread.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      setDraft("");
      await mutate();
      onChanged();
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <button
        onClick={onBack}
        className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-stone-500 transition hover:text-stone-900"
      >
        <ArrowLeft className="h-4 w-4" /> Support
      </button>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 className="text-lg font-semibold text-stone-900">
          {thread.display_name || thread.email || "Someone"}
        </h2>
        {thread.member_id && (
          <Link
            href={`/members/${thread.member_id}`}
            className="inline-flex items-center gap-1 text-[12px] font-medium text-indigo-600 hover:underline"
          >
            <Store className="h-3.5 w-3.5" /> their page
          </Link>
        )}
      </div>
      {thread.email && <p className="text-[12px] text-stone-400">{thread.email}</p>}

      <div data-private className="mt-4 space-y-3">
        {messages.map((m) => {
          const staff = m.sender === "staff";
          return (
            <div key={m.id} className={staff ? "flex justify-end" : "flex justify-start"}>
              <div
                className={
                  "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[14px] leading-relaxed " +
                  (staff
                    ? "bg-indigo-600 text-white"
                    : "border border-stone-200 bg-white text-stone-900")
                }
              >
                <span className="whitespace-pre-line">{m.body}</span>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      <div className="mt-4 flex items-end gap-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void reply();
            }
          }}
          rows={2}
          placeholder="Reply…"
          data-private
          className="w-full resize-y rounded-2xl border border-stone-300 px-3.5 py-3 text-[16px] outline-none transition placeholder:text-stone-400 focus:border-stone-900"
        />
        <button
          onClick={reply}
          disabled={sending || !draft.trim()}
          aria-label="Send reply"
          className="inline-flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-full bg-stone-900 text-white transition hover:bg-stone-800 disabled:opacity-40"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
