"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, MessageSquare, Loader2, Sparkles, Send, ArrowRight, Check, MapPin, Star, Globe, Clock, Tag } from "lucide-react";
import { VoiceCall } from "@/components/VoiceCall";
import type { BriefInput } from "@/lib/onboard";

// The FINDINGS step of /join, straight after ownership is verified. The member
// already exists; this conversation (voice or text) enriches it — description,
// category, what they sell, socials, and (the real prize) how they want to
// collaborate — which powers their local matches.
//
// On mount we run a fast web-search research pass (/api/join/research) and SHOW
// what came back: the listing facts and what the web says. That is the hook
// (2026-10-01). It used to run silently behind a "Bring your page to life"
// screen, so the research was paid for and the person never saw it — and
// "tell us about your business" is a much harder thing to start talking about
// than "here is what we found, what did we get wrong?". Correcting something
// about yourself takes no effort to begin. The `brief` is threaded into both
// modes with `refine` on, so the host opens by asking for fixes rather than
// reading the screen back to them.
//
// Both modes hand the transcript to the parent, which POSTs it to
// /api/join/enrich (full connector brain → enrich-in-place, re-embeds) once the
// page exists. Everything here is optional: "Looks right" moves straight on.

type Mode = "choose" | "text" | "voice";
export interface Msg { role: "user" | "assistant"; content: string }

export function JoinInterview({
  memberId,
  bizName,
  kind,
  seed,
  onDone,
}: {
  memberId: string;
  bizName: string;
  kind: string;
  // What we already know client-side (Google Places pick, or the artist's name +
  // city). Sent to /api/join/research as the instant baseline for the brief.
  seed?: BriefInput;
  /** Kept for the call sites; nothing here writes any more. */
  demo?: boolean;
  /** The conversation, for the parent to save once there is a page. Empty on skip. */
  onDone: (messages: Msg[]) => void;
}) {
  const [mode, setMode] = useState<Mode>("choose");
  const [saving, setSaving] = useState(false);
  // Saving moved to the parent; the error slot stays for the voice/text views.
  const saveErr = "";

  // undefined = research still running; string = ready (may be ""); the interview
  // modes wait on this so the agent opens warm.
  const [brief, setBrief] = useState<string | undefined>(undefined);
  // What is shown. Separate from the brief because the brief is written for the
  // model; these are written for the person.
  const [research, setResearch] = useState<string | null>(null);
  const [facts, setFacts] = useState<BriefInput>(seed ?? {});
  const [readMore, setReadMore] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      try {
        const res = await fetch("/api/join/research", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ memberId, seed: seed ?? {} }),
        });
        const d = await res.json().catch(() => ({}));
        if (typeof d.research === "string" && d.research.trim()) setResearch(d.research);
        if (d.facts && typeof d.facts === "object") setFacts(d.facts as BriefInput);
        setBrief(typeof d.brief === "string" ? d.brief : "");
      } catch {
        setBrief("");
      }
    })();
    // memberId is stable for the life of this step; seed is captured once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberId]);

  // Hand the transcript UP rather than saving it here. Since 2026-10-01 this
  // step can run before there is an account (or a page) to save it to, so the
  // parent holds it and writes it after sign-in, with everything else.
  function saveAndDone(messages: Msg[]) {
    setSaving(true);
    onDone(messages);
  }

  if (mode === "choose") {
    const loading = brief === undefined;
    const place = [facts.neighborhood, facts.city].filter(Boolean).join(", ");
    const category = [facts.category, facts.subcategory].filter(Boolean).join(" · ");
    const rows: { icon: typeof MapPin; text: string }[] = [];
    if (facts.address || place) rows.push({ icon: MapPin, text: String(facts.address || place) });
    if (category) rows.push({ icon: Tag, text: category });
    if (facts.rating) {
      rows.push({
        icon: Star,
        text: `${facts.rating}${facts.ratingCount ? ` · ${facts.ratingCount} Google reviews` : " on Google"}`,
      });
    }
    if (facts.websiteUrl) rows.push({ icon: Globe, text: String(facts.websiteUrl).replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "") });
    const offerings = [...(facts.products || []), ...(facts.services || [])].filter(Boolean).slice(0, 8);

    return (
      <div className="space-y-5">
        <header>
          <div className="mb-4 grid h-14 w-14 place-items-center rounded-full bg-coral-50">
            {loading ? (
              <Loader2 className="h-7 w-7 animate-spin text-coral-600" />
            ) : (
              <Sparkles className="h-7 w-7 text-coral-600" />
            )}
          </div>
          <h1 className="text-[28px] font-bold leading-tight tracking-tight text-stone-900">
            {loading ? `Looking up ${bizName}…` : `Here's what we found`}
          </h1>
          <p className="mt-2 text-[15px] leading-relaxed text-stone-500">
            {loading
              ? "Reading your listing and searching the web — a few seconds."
              : `Your page is written from this. Check it over — then tell us what we got wrong or missed.`}
          </p>
        </header>

        {/* The facts — mostly the Google listing, already paid for. */}
        {rows.length > 0 && (
          <section className="rounded-2xl border border-stone-200 bg-white p-4">
            <p className="text-[15px] font-semibold text-stone-900">{facts.name || bizName}</p>
            <dl className="mt-2.5 space-y-2 text-[14px] text-stone-600">
              {rows.map((r, i) => (
                <div key={i} className="flex gap-2.5">
                  <r.icon className="mt-0.5 h-4 w-4 shrink-0 text-stone-400" />
                  <dd className="min-w-0 break-words">{r.text}</dd>
                </div>
              ))}
              {facts.hours && (
                <div className="flex gap-2.5">
                  <Clock className="mt-0.5 h-4 w-4 shrink-0 text-stone-400" />
                  <dd className="min-w-0 whitespace-pre-line text-[13px] leading-relaxed">{compactHours(String(facts.hours))}</dd>
                </div>
              )}
            </dl>
            {offerings.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {offerings.map((o) => (
                  <span key={o} className="rounded-full bg-stone-100 px-2.5 py-1 text-[12px] text-stone-700">{o}</span>
                ))}
              </div>
            )}
          </section>
        )}

        {/* What the web says. Shown as soon as it lands; a skeleton until then
            so the card doesn't jump in under someone already reading. */}
        <section className="rounded-2xl border border-stone-200 bg-white p-4">
          <h2 className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wide text-stone-500">
            <Sparkles className="h-3.5 w-3.5 text-coral-600" /> What the web says
          </h2>
          {loading ? (
            <div className="mt-3 space-y-2">
              <div className="h-3 w-full animate-pulse rounded bg-stone-100" />
              <div className="h-3 w-11/12 animate-pulse rounded bg-stone-100" />
              <div className="h-3 w-2/3 animate-pulse rounded bg-stone-100" />
            </div>
          ) : research ? (
            <>
              <p
                className={
                  "mt-2.5 whitespace-pre-line text-[14px] leading-relaxed text-stone-700" +
                  (readMore ? "" : " line-clamp-[9]")
                }
              >
                {research}
              </p>
              {research.length > 420 && (
                <button
                  onClick={() => setReadMore((v) => !v)}
                  className="mt-1.5 text-[13px] font-semibold text-stone-900 underline underline-offset-2"
                >
                  {readMore ? "Show less" : "Read it all"}
                </button>
              )}
            </>
          ) : (
            <p className="mt-2.5 text-[14px] leading-relaxed text-stone-500">
              We couldn&apos;t find much about {bizName} online — which is exactly why we&apos;d rather
              hear it from you.
            </p>
          )}
        </section>

        {/* The hook. Fixing what we found is the reason to start talking. */}
        <div className="space-y-2 pt-1">
          <p className="text-[15px] font-semibold text-stone-900">
            {research ? "Anything wrong, missing or out of date?" : "Fill in the gaps"}
          </p>
          <button
            onClick={() => setMode("voice")}
            disabled={loading}
            className="flex w-full items-center gap-3 rounded-2xl border-2 border-stone-200 bg-white p-4 text-left transition hover:border-stone-900 active:scale-[0.98] disabled:opacity-50"
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-coral-50">
              <Mic className="h-5 w-5 text-coral-600" />
            </span>
            <span className="flex-1">
              <span className="block text-[15px] font-semibold text-stone-900">Talk it through</span>
              <span className="block text-[13px] text-stone-500">A 2-minute voice call, right here — no phone number</span>
            </span>
            <ArrowRight className="h-4 w-4 text-stone-300" />
          </button>
          <button
            onClick={() => setMode("text")}
            disabled={loading}
            className="flex w-full items-center gap-3 rounded-2xl border-2 border-stone-200 bg-white p-4 text-left transition hover:border-stone-900 active:scale-[0.98] disabled:opacity-50"
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-coral-50">
              <MessageSquare className="h-5 w-5 text-coral-600" />
            </span>
            <span className="flex-1">
              <span className="block text-[15px] font-semibold text-stone-900">Type your fixes</span>
              <span className="block text-[13px] text-stone-500">A short back-and-forth chat</span>
            </span>
            <ArrowRight className="h-4 w-4 text-stone-300" />
          </button>
        </div>
        <button onClick={() => onDone([])} className="w-full py-1 text-[13px] font-medium text-stone-400 transition hover:text-stone-700">
          Looks right — continue
        </button>
      </div>
    );
  }

  if (mode === "voice") {
    return <VoiceInterview bizName={bizName} kind={kind} brief={brief} saving={saving} saveErr={saveErr} onSave={saveAndDone} onBack={() => setMode("choose")} />;
  }

  return <TextInterview bizName={bizName} brief={brief} hasFindings={!!research} saving={saving} saveErr={saveErr} onSave={saveAndDone} onBack={() => setMode("choose")} />;
}

// Google hands hours back as "Monday: 7:30 AM – 6:00 PM, Tuesday: …" — seven
// near-identical clauses. Same hours every day reads as one line; anything
// else is one day per line rather than a paragraph.
function compactHours(raw: string): string {
  const days = raw.split(/,\s*(?=[A-Z][a-z]+day:)|\n/).map((d) => d.trim()).filter(Boolean);
  const times = days.map((d) => d.replace(/^[A-Za-z]+day:\s*/, ""));
  if (days.length === 7 && times.every((t) => t === times[0])) return `Every day · ${times[0]}`;
  return days.join("\n");
}

// A shared "getting the interviewer ready" panel while research is still running.
function Preparing({ bizName }: { bizName: string }) {
  return (
    <div className="flex min-h-[280px] flex-col items-center justify-center gap-3 text-center">
      <Loader2 className="h-6 w-6 animate-spin text-violet-600" />
      <p className="text-sm text-stone-500">Reading up on {bizName} so this is quick…</p>
    </div>
  );
}

// ── Voice ────────────────────────────────────────────────────────────────────
function VoiceInterview({
  bizName,
  kind,
  brief,
  saving,
  saveErr,
  onSave,
  onBack,
}: {
  bizName: string;
  kind: string;
  brief: string | undefined;
  saving: boolean;
  saveErr: string;
  onSave: (m: Msg[]) => void;
  onBack: () => void;
}) {
  // Accumulate the running transcript from the data channel.
  const msgsRef = useRef<Msg[]>([]);
  const [heard, setHeard] = useState(0);

  // Don't mint the Realtime session until the brief resolves — VoiceCall
  // auto-starts on mount and captures tokenBody once, so the agent must have the
  // brief before it connects (that's what makes it open warm).
  if (brief === undefined) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold text-stone-900">Tell me about {bizName}</h1>
        <div className="rounded-2xl border border-stone-200 bg-stone-50">
          <Preparing bizName={bizName} />
        </div>
        <button onClick={onBack} className="block w-full text-xs font-medium text-stone-400 hover:text-stone-600">
          Back
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-stone-900">Tell me about {bizName}</h1>
      <div className="min-h-[320px] rounded-2xl border border-stone-200 bg-stone-50">
        <VoiceCall
          memberName={bizName}
          tokenUrl="/api/onboard/voice"
          tokenBody={{ name: bizName, kind, brief, refine: true }}
          // The interviewer must open with what it researched — that recognition
          // IS the point of this step. Without this it waits for the member to
          // talk first and the whole beat is lost.
          openWithGreeting
          onTranscript={(m) => {
            msgsRef.current = [...msgsRef.current, m];
            setHeard(msgsRef.current.length);
          }}
          onClose={() => onSave(msgsRef.current)}
        />
      </div>
      {saveErr && <p className="rounded-lg bg-rose-50 px-3.5 py-2 text-[13px] text-rose-700">{saveErr}</p>}
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
  brief,
  hasFindings,
  saving,
  saveErr,
  onSave,
  onBack,
}: {
  bizName: string;
  brief: string | undefined;
  /** Research came back and is on screen — open by asking what to fix. */
  hasFindings: boolean;
  saving: boolean;
  saveErr: string;
  onSave: (m: Msg[]) => void;
  onBack: () => void;
}) {
  // With findings on screen the opener is a fixed line, not a model call: the
  // model kept reciting the screen back and jumping to the wants pitch, and
  // this one line is the whole hook — it should never vary.
  const [messages, setMessages] = useState<Msg[]>(() =>
    hasFindings
      ? [{ role: "assistant", content: `Hi! That's what we found on ${bizName} — anything we got wrong, missing, or out of date?` }]
      : [],
  );
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const openerAsked = useRef(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const userTurns = messages.filter((m) => m.role === "user").length;

  // Once research resolves, ask the brain for a tailored opener so turn 1 already
  // reflects what we found. The fallback deliberately asks NOTHING researchable —
  // if the opener call fails we'd rather admit we came up empty than open with
  // "what do you sell?", which tells them nobody looked (see NEVER_ASK in
  // lib/onboard.ts). It's the one line the brief can't rescue, so it plays honest.
  useEffect(() => {
    if (brief === undefined || openerAsked.current) return;
    openerAsked.current = true;
    const fallback = `Hey — good to meet you. I went looking for ${bizName} and didn't turn up as much as I'd like, so I'd rather hear it from you than guess. Tell me about it in your own words.`;
    // Findings on screen: the opener was set in the initial state (below).
    if (hasFindings) return;
    (async () => {
      setBusy(true);
      try {
        const res = await fetch("/api/onboard/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: [], brief, refine: true }),
        });
        const d = await res.json();
        setMessages([{ role: "assistant", content: d.reply || fallback }]);
      } catch {
        setMessages([{ role: "assistant", content: fallback }]);
      } finally {
        setBusy(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brief]);

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
        body: JSON.stringify({ messages: next, brief, refine: true }),
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

  if (brief === undefined) {
    return (
      <div className="space-y-3">
        <h1 className="text-xl font-bold text-stone-900">Tell me about {bizName}</h1>
        <div className="rounded-2xl border border-stone-200 bg-stone-50">
          <Preparing bizName={bizName} />
        </div>
        <button onClick={onBack} className="block w-full text-xs font-medium text-stone-400 hover:text-stone-600">
          Back
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-bold text-stone-900">Tell me about {bizName}</h1>
      <div ref={scrollRef} className="max-h-[46vh] space-y-3 overflow-y-auto rounded-2xl border border-stone-200 bg-stone-50 p-3" data-private>
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
          placeholder="What should we fix or add?"
          className="w-full bg-transparent text-sm outline-none"
        />
        <button onClick={send} disabled={busy || !text.trim()} className="text-violet-600 disabled:text-stone-300" aria-label="Send">
          <Send className="h-4 w-4" />
        </button>
      </div>

      {saveErr && <p className="rounded-lg bg-rose-50 px-3.5 py-2 text-[13px] text-rose-700">{saveErr}</p>}

      <button
        onClick={() => onSave(messages)}
        disabled={saving || userTurns === 0}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        {saving ? "Saving…" : userTurns === 0 ? "Reply once to save" : "Save my profile"}
      </button>
      <button onClick={onBack} disabled={saving} className="block w-full text-xs font-medium text-stone-400 hover:text-stone-600 disabled:opacity-50">
        Back
      </button>
    </div>
  );
}
