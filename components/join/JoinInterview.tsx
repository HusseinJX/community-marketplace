"use client";

import { useRef, useState } from "react";
import { Mic, MessageSquare, Loader2, Sparkles, Send, ArrowRight, Check } from "lucide-react";
import { VoiceCall } from "@/components/VoiceCall";

// The onboarding INTERVIEW step of /join. The member already exists + is
// verified; this conversation (voice or text) enriches it — description,
// category, what they sell, price, socials — which powers their local matches.
// Both modes POST the transcript to /api/join/enrich (extract → patch-member,
// re-embeds). Everything here is optional: "Skip for now" jumps straight to done.

type Mode = "choose" | "text" | "voice";
interface Msg { role: "user" | "assistant"; content: string }

export function JoinInterview({
  memberId,
  bizName,
  kind,
  onDone,
}: {
  memberId: string;
  bizName: string;
  kind: string;
  onDone: () => void;
}) {
  const [mode, setMode] = useState<Mode>("choose");
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState("");

  // Persist the transcript, then finish. Enrichment is best-effort — the page
  // already exists, so a hiccup here should never trap the person.
  async function saveAndDone(messages: Msg[]) {
    setSaving(true);
    setSaveErr("");
    try {
      const res = await fetch("/api/join/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId, messages }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Couldn't save.");
      onDone();
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : "Couldn't save your answers.");
      setSaving(false);
    }
  }

  if (mode === "choose") {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-violet-600" />
          <h1 className="text-2xl font-bold text-stone-900">Bring your page to life</h1>
        </div>
        <p className="text-sm text-stone-500">
          A quick 2-minute interview about {bizName}. It writes your profile and powers who WhatsLocal
          matches you with — collaborators, events, customers. Talk it out or type it.
        </p>
        <div className="space-y-2 pt-1">
          <button
            onClick={() => setMode("voice")}
            className="flex w-full items-center gap-3 rounded-xl border border-stone-200 bg-white p-4 text-left hover:border-violet-300 hover:bg-violet-50"
          >
            <Mic className="h-5 w-5 text-violet-600" />
            <span className="flex-1">
              <span className="block text-sm font-semibold text-stone-900">Talk it out</span>
              <span className="block text-xs text-stone-500">A quick voice call — no phone number, right here</span>
            </span>
            <ArrowRight className="h-4 w-4 text-stone-300" />
          </button>
          <button
            onClick={() => setMode("text")}
            className="flex w-full items-center gap-3 rounded-xl border border-stone-200 bg-white p-4 text-left hover:border-violet-300 hover:bg-violet-50"
          >
            <MessageSquare className="h-5 w-5 text-violet-600" />
            <span className="flex-1">
              <span className="block text-sm font-semibold text-stone-900">Type it</span>
              <span className="block text-xs text-stone-500">A short back-and-forth chat</span>
            </span>
            <ArrowRight className="h-4 w-4 text-stone-300" />
          </button>
        </div>
        <button onClick={onDone} className="text-xs font-medium text-stone-400 hover:text-stone-600">
          Skip for now — I&apos;ll do this later
        </button>
      </div>
    );
  }

  if (mode === "voice") {
    return <VoiceInterview bizName={bizName} kind={kind} saving={saving} saveErr={saveErr} onSave={saveAndDone} onBack={() => setMode("choose")} />;
  }

  return <TextInterview bizName={bizName} saving={saving} saveErr={saveErr} onSave={saveAndDone} onBack={() => setMode("choose")} />;
}

// ── Voice ────────────────────────────────────────────────────────────────────
function VoiceInterview({
  bizName,
  kind,
  saving,
  saveErr,
  onSave,
  onBack,
}: {
  bizName: string;
  kind: string;
  saving: boolean;
  saveErr: string;
  onSave: (m: Msg[]) => void;
  onBack: () => void;
}) {
  // Accumulate the running transcript from the data channel.
  const msgsRef = useRef<Msg[]>([]);
  const [heard, setHeard] = useState(0);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-stone-900">Tell me about {bizName}</h1>
      <div className="min-h-[320px] rounded-2xl border border-stone-200 bg-stone-50">
        <VoiceCall
          memberName={bizName}
          tokenUrl="/api/onboard/voice"
          tokenBody={{ name: bizName, kind }}
          onTranscript={(m) => {
            msgsRef.current = [...msgsRef.current, m];
            setHeard(msgsRef.current.length);
          }}
          onClose={() => onSave(msgsRef.current)}
        />
      </div>
      {saveErr && <p className="rounded-lg bg-rose-50 px-4 py-2 text-sm text-rose-700">{saveErr}</p>}
      <p className="text-center text-xs text-stone-400">
        {heard > 0 ? "Got it — tap below when you're done." : "Allow the mic and start talking."}
      </p>
      <button
        onClick={() => onSave(msgsRef.current)}
        disabled={saving}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        {saving ? "Saving…" : "Finish & save my profile"}
      </button>
      <button onClick={onBack} disabled={saving} className="block w-full text-xs font-medium text-stone-400 hover:text-stone-600 disabled:opacity-50">
        Back
      </button>
    </div>
  );
}

// ── Text ─────────────────────────────────────────────────────────────────────
function TextInterview({
  bizName,
  saving,
  saveErr,
  onSave,
  onBack,
}: {
  bizName: string;
  saving: boolean;
  saveErr: string;
  onSave: (m: Msg[]) => void;
  onBack: () => void;
}) {
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content: `Nice to meet you — let's set up ${bizName}. In a sentence or two, what do you make or sell?`,
    },
  ]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const userTurns = messages.filter((m) => m.role === "user").length;

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
        body: JSON.stringify({ messages: next }),
      });
      const d = await res.json();
      setMessages([...next, { role: "assistant", content: d.reply || "Got it!" }]);
    } catch {
      setMessages([...next, { role: "assistant", content: "Sorry — say that again?" }]);
    } finally {
      setBusy(false);
      requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: 9e9, behavior: "smooth" }));
    }
  }

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-bold text-stone-900">Tell me about {bizName}</h1>
      <div ref={scrollRef} className="max-h-[46vh] space-y-3 overflow-y-auto rounded-2xl border border-stone-200 bg-stone-50 p-3">
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div
              className={
                "max-w-[85%] rounded-2xl px-3.5 py-2 text-sm " +
                (m.role === "user" ? "bg-violet-600 text-white" : "bg-white text-stone-800 border border-stone-200")
              }
            >
              {m.content}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex justify-start">
            <div className="rounded-2xl border border-stone-200 bg-white px-3.5 py-2 text-stone-400">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 rounded-full border border-stone-300 px-3 py-1.5">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Type your answer…"
          className="w-full bg-transparent text-sm outline-none"
        />
        <button onClick={send} disabled={busy || !text.trim()} className="text-violet-600 disabled:text-stone-300" aria-label="Send">
          <Send className="h-4 w-4" />
        </button>
      </div>

      {saveErr && <p className="rounded-lg bg-rose-50 px-4 py-2 text-sm text-rose-700">{saveErr}</p>}

      <button
        onClick={() => onSave(messages)}
        disabled={saving || userTurns === 0}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        {saving ? "Saving…" : userTurns === 0 ? "Answer one question to save" : "Save my profile"}
      </button>
      <button onClick={onBack} disabled={saving} className="block w-full text-xs font-medium text-stone-400 hover:text-stone-600 disabled:opacity-50">
        Back
      </button>
    </div>
  );
}
