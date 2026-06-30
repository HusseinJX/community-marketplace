"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Send, Check, Sparkles } from "lucide-react";
import { useAuth, SignInButton } from "@clerk/nextjs";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

export function OnboardChat({ eventId, eventName }: { eventId: string | null; eventName: string | null }) {
  const { isSignedIn, isLoaded } = useAuth();
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content: eventName
        ? `Hey! Excited to have you at ${eventName}. What's your business called, and what do you sell?`
        : "Hey! What's your business called, and what do you sell or make?",
    },
  ]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [created, setCreated] = useState<{ claimUrl: string } | null>(null);
  const [err, setErr] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    const t = text.trim();
    if (!t || busy) return;
    const next = [...messages, { role: "user" as const, content: t }];
    setMessages(next);
    setText("");
    setBusy(true);
    try {
      const res = await fetch("/api/onboard/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, eventName }),
      });
      const d = await res.json();
      setMessages((m) => [...m, { role: "assistant", content: d.reply }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "Hmm, try that again?" }]);
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    setFinishing(true);
    setErr("");
    try {
      // The connector profiles the whole conversation (same brain as SMS/web),
      // creates the member + vectors, then we tag the event lineup.
      const res = await fetch("/api/onboard/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages, eventId: eventId || undefined, mode: "self" }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Couldn't create your profile");
      setCreated({ claimUrl: d.claimUrl });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setFinishing(false);
    }
  }

  if (created) {
    return (
      <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-6 text-center">
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500">
          <Check className="h-5 w-5 text-white" />
        </div>
        <p className="font-semibold text-stone-900">You&apos;re on WhatsLocal! 🎉</p>
        <p className="mt-1 text-sm text-stone-600">
          {eventName ? "The organizer will confirm you on the lineup. " : ""}
          Claim your page to add photos, products, and more:
        </p>
        <Link href={created.claimUrl} className="mt-3 inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
          Claim my page
        </Link>
      </div>
    );
  }

  const enoughToFinish = messages.filter((m) => m.role === "user").length >= 1;

  return (
    <div className="flex h-[60vh] flex-col rounded-2xl border border-stone-200 bg-white">
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${m.role === "user" ? "bg-indigo-600 text-white" : "bg-stone-100 text-stone-800"}`}>
              {m.content}
            </div>
          </div>
        ))}
        {busy && <p className="text-xs text-stone-400">…</p>}
        <div ref={endRef} />
      </div>

      {enoughToFinish && (
        <div className="border-t border-stone-100 px-3 py-2">
          {isLoaded && !isSignedIn ? (
            <SignInButton mode="modal">
              <button className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700">
                <Sparkles className="h-3.5 w-3.5" /> Sign in to create my profile
              </button>
            </SignInButton>
          ) : (
            <button
              onClick={finish}
              disabled={finishing}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              <Sparkles className="h-3.5 w-3.5" /> {finishing ? "Setting up…" : "Create my profile"}
            </button>
          )}
          {err && <span className="ml-2 text-xs text-rose-600">{err}</span>}
        </div>
      )}

      <div className="flex items-center gap-2 border-t border-stone-100 p-3">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Type your answer…"
          className="flex-1 rounded-lg border border-stone-200 px-3 py-2 text-sm"
        />
        <button onClick={send} disabled={busy} className="rounded-lg bg-indigo-600 p-2 text-white hover:bg-indigo-700 disabled:opacity-50">
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
