"use client";

import { useEffect, useRef, useState } from "react";
import { Send, X, Sparkles, Phone } from "lucide-react";
import { VoiceCall } from "@/components/VoiceCall";

// Opened by the profile's "Inquire" button via this event (no floating launcher).
export const OPEN_ASSISTANT_EVENT = "open-assistant";

type Msg = { role: "user" | "assistant"; content: string };

export function AskAssistant({
  memberId,
  memberName,
}: {
  memberId: string;
  memberName: string;
}) {
  const [open, setOpen] = useState(false);
  const [inCall, setInCall] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const conversationId = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener(OPEN_ASSISTANT_EVENT, handler);
    return () => window.removeEventListener(OPEN_ASSISTANT_EVENT, handler);
  }, []);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || busy) return;

    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages([...next, { role: "assistant", content: "" }]);
    setDraft("");
    setBusy(true);

    try {
      const res = await fetch(`/api/chat/${memberId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, conversationId: conversationId.current }),
      });

      if (!res.ok || !res.body) {
        throw new Error(await res.text().catch(() => "Request failed"));
      }
      const cid = res.headers.get("X-Conversation-Id");
      if (cid) conversationId.current = cid;

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: "assistant", content: acc };
          return copy;
        });
      }
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
    <>
      {/* Panel — launched from the profile's "Inquire" button */}
      {open && (
        <div className="fixed bottom-5 right-5 z-50 flex h-[min(34rem,80vh)] w-[min(24rem,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              <div className="text-sm font-semibold leading-tight">
                {memberName} Assistant
                <div className="text-[11px] font-normal text-indigo-100">
                  {inCall ? "Voice call over internet" : "Ask about products, hours & more"}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {!inCall && (
                <button
                  onClick={() => setInCall(true)}
                  aria-label="Call over internet"
                  title="Call over internet"
                  className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-xs font-semibold hover:bg-white/25"
                >
                  <Phone className="h-3.5 w-3.5" /> Call
                </button>
              )}
              <button
                onClick={() => {
                  setInCall(false);
                  setOpen(false);
                }}
                aria-label="Close"
                className="rounded-full p-1 hover:bg-white/15"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {inCall ? (
            <VoiceCall memberId={memberId} memberName={memberName} onClose={() => setInCall(false)} />
          ) : (
            <>
              <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4" data-private>
                {messages.length === 0 && (
                  <div className="text-sm text-stone-500">
                    Hi! I&apos;m the assistant for <span className="font-medium text-stone-700">{memberName}</span>.
                    Ask me anything — products, prices, hours, events, or an existing order. Prefer talking?{" "}
                    <button onClick={() => setInCall(true)} className="font-medium text-indigo-600 hover:underline">
                      Call over internet
                    </button>
                    .
                  </div>
                )}
                {messages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={
                        "max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm leading-relaxed " +
                        (m.role === "user" ? "bg-indigo-600 text-white" : "bg-stone-100 text-stone-800")
                      }
                    >
                      {m.content || (busy ? "…" : "")}
                    </div>
                  </div>
                ))}
              </div>

              <form onSubmit={send} className="flex items-center gap-2 border-t border-stone-100 px-3 py-3">
                <input
                  ref={inputRef}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={`Message ${memberName}…`}
                  className="flex-1 rounded-full border border-stone-200 bg-stone-50 px-3.5 py-2 text-[13px] text-stone-800 placeholder:text-stone-400 focus:border-indigo-300 focus:bg-white focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!draft.trim() || busy}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-indigo-600 text-white transition hover:bg-indigo-700 disabled:bg-stone-200 disabled:text-stone-400"
                  aria-label="Send"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </>
          )}
        </div>
      )}
    </>
  );
}
