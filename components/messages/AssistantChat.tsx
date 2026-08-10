"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Send, Sparkles, ChevronRight } from "lucide-react";

type Msg = { role: "user" | "assistant"; content: string; members?: MemberCardData[] };

interface MemberCardData {
  id: string;
  name: string;
  category?: string;
  city?: string;
  type?: string;
}

// Stable per-device conversation id so the brain keeps one thread (and could be
// linked to an SMS thread later). UUID — the connector requires that shape.
function getSessionId(): string {
  if (typeof window === "undefined") return "";
  try {
    let id = window.localStorage.getItem("wl_assistant_session");
    if (!id) {
      id = crypto.randomUUID();
      window.localStorage.setItem("wl_assistant_session", id);
    }
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

// Wire protocol: whitespace heartbeats while the brain works, then a trailing
// JSON object `{ reply, members? }`. Pull the trailing object out.
function parseFinal(raw: string): { reply: string; members: MemberCardData[] } | null {
  const t = raw.trim();
  const start = t.lastIndexOf("{");
  if (start < 0) return null;
  try {
    const obj = JSON.parse(t.slice(start));
    if (typeof obj?.reply === "string") {
      return { reply: obj.reply, members: Array.isArray(obj.members) ? obj.members : [] };
    }
    if (typeof obj?.error === "string") return { reply: obj.error, members: [] };
  } catch {
    /* incomplete mid-stream */
  }
  return null;
}

const STARTERS = [
  "Find me a coffee shop nearby",
  "Local makers I should know",
  "What's happening this weekend?",
  "Community orgs near me",
];

export function AssistantChat() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function send(input: string) {
    const text = input.trim();
    if (!text || busy) return;
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages([...next, { role: "assistant", content: "" }]);
    setDraft("");
    setBusy(true);

    try {
      const res = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, sessionId: getSessionId() }),
      });
      if (!res.ok || !res.body) throw new Error(await res.text().catch(() => "Request failed"));

      // Read to completion (heartbeats keep the stream alive), then parse the
      // trailing JSON. Content stays empty → typing indicator shows meanwhile.
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      const chunks: string[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(decoder.decode(value, { stream: true }));
      }
      const final = parseFinal(chunks.join(""));
      setMessages((prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = {
          role: "assistant",
          content: final?.reply || "Sorry — I didn't catch that. Try again?",
          members: final?.members ?? [],
        };
        return copy;
      });
    } catch {
      setMessages((prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = {
          role: "assistant",
          content: "Sorry — I couldn't reach the assistant. Please try again.",
        };
        return copy;
      });
    } finally {
      setBusy(false);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={scrollRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-5" data-private>
        {messages.length === 0 && (
          <div className="space-y-4 pt-4">
            <div className="flex flex-col items-center text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-lg">
                <Sparkles className="h-7 w-7" />
              </span>
              <h2 className="mt-3 text-base font-semibold text-stone-900">WhatsLocal Assistant</h2>
              <p className="mt-1 max-w-xs text-sm text-stone-500">
                Ask me to find local spots, makers, events, or community orgs — same as texting us,
                right here.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {STARTERS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-stone-600 ring-1 ring-stone-200 hover:ring-indigo-300"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => {
          if (m.role === "user") {
            return (
              <div key={i} className="flex justify-end">
                <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl bg-indigo-600 px-3.5 py-2 text-sm text-white">
                  {m.content}
                </div>
              </div>
            );
          }
          const members = m.members ?? [];
          return (
            <div key={i} className="space-y-3">
              <div className="flex justify-start">
                <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl bg-stone-100 px-3.5 py-2 text-sm text-stone-800">
                  {m.content || (busy ? "…" : "")}
                </div>
              </div>
              {members.length > 0 && (
                <div className="grid grid-cols-1 gap-2">
                  {members.map((c) => (
                    <Link
                      key={c.id}
                      href={`/members/${c.id}`}
                      className="flex items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white p-3 transition hover:border-indigo-300"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-stone-900">{c.name}</span>
                        <span className="block truncate text-xs text-stone-500">
                          {[c.category, c.city].filter(Boolean).join(" · ") || c.type}
                        </span>
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-stone-400" />
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(draft);
        }}
        className="flex shrink-0 items-center gap-2 border-t border-stone-100 bg-white px-3 py-3"
      >
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Ask the assistant…"
          className="flex-1 rounded-full border border-stone-200 bg-stone-50 px-4 py-2.5 text-sm text-stone-800 placeholder:text-stone-400 focus:border-indigo-300 focus:bg-white focus:outline-none"
        />
        <button
          type="submit"
          disabled={!draft.trim() || busy}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-indigo-600 text-white transition hover:bg-indigo-700 disabled:bg-stone-200 disabled:text-stone-400"
          aria-label="Send"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
