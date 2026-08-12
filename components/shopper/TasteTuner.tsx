"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { mutate } from "swr";
import { Sparkles, Send, Trash2, Check, Loader2 } from "lucide-react";
import { tasteId } from "@/lib/taste-id";

// "What you're into" — the shopper's own view of the profile that ranks their
// events feed.
//
// The design rule here is that NOTHING is stored about someone that they cannot
// read, edit and delete on this screen. The chat is a convenience for filling it
// in, not a second hidden channel: every tool call it makes lands in the same
// paragraph and the same chips shown below it.

interface Taste {
  interests: string[];
  about: string | null;
  updatedAt: string | null;
  hasVector: boolean;
}
interface Chip {
  id: string;
  label: string;
  emoji: string;
}
type Msg = { role: "user" | "assistant"; content: string };

/** Repaint any cached personalised feed — it was ranked by the old profile. */
const refreshFeeds = () =>
  mutate((key) => Array.isArray(key) && key[0] === "events-personalize", undefined, {
    revalidate: true,
  });

export function TasteTuner() {
  const [id, setId] = useState<string | null>(null);
  const [chips, setChips] = useState<Chip[]>([]);
  const [taste, setTaste] = useState<Taste | null>(null);
  const [about, setAbout] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  // The browser's id is only knowable on the client, so the first load happens
  // in an effect rather than during render.
  useEffect(() => {
    const mine = tasteId();
    setId(mine);
    fetch(`/api/shopper/taste${mine ? `?id=${encodeURIComponent(mine)}` : ""}`)
      .then((r) => r.json())
      .then((d) => {
        setChips(d.interests ?? []);
        setTaste(d.taste ?? null);
        setAbout(d.taste?.about ?? "");
      })
      .catch(() => setUnavailable(true))
      .finally(() => setLoaded(true));
  }, []);

  const save = useCallback(
    async (patch: { interests?: string[]; about?: string | null }) => {
      setSaving(true);
      try {
        const r = await fetch("/api/shopper/taste", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, ...patch }),
        });
        if (!r.ok) throw new Error("save failed");
        const d = await r.json();
        setTaste(d.taste);
        setSavedAt(Date.now());
        refreshFeeds();
      } catch {
        setUnavailable(true);
      } finally {
        setSaving(false);
      }
    },
    [id],
  );

  const toggleChip = (chipId: string) => {
    const now = taste?.interests ?? [];
    const next = now.includes(chipId) ? now.filter((c) => c !== chipId) : [...now, chipId];
    // Optimistic: the chip must respond to the tap, not to the round trip.
    setTaste((t) => ({
      interests: next,
      about: t?.about ?? null,
      updatedAt: t?.updatedAt ?? null,
      hasVector: t?.hasVector ?? false,
    }));
    save({ interests: next });
  };

  const send = async () => {
    const text = draft.trim();
    if (!text || thinking) return;
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setDraft("");
    setThinking(true);
    try {
      const r = await fetch("/api/shopper/taste/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, messages: next }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "failed");
      setMessages([...next, { role: "assistant", content: d.reply }]);
      if (d.taste !== undefined) {
        setTaste(d.taste);
        // The chat edits the SAME paragraph shown in the box below, so the box
        // has to follow — otherwise it displays a version that no longer exists
        // and the next manual save silently reverts what the chat just did.
        setAbout(d.taste?.about ?? "");
        refreshFeeds();
      }
    } catch {
      setMessages([
        ...next,
        { role: "assistant", content: "Sorry — I couldn't save that just now. Try again in a moment?" },
      ]);
    } finally {
      setThinking(false);
    }
  };

  const forget = async () => {
    if (!confirm("Delete what we've saved about what you like? This can't be undone.")) return;
    await fetch("/api/shopper/taste", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    }).catch(() => {});
    setTaste(null);
    setAbout("");
    setMessages([]);
    refreshFeeds();
  };

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinking]);

  if (!loaded) return null;
  // No storage configured, or this browser can't keep an id. Saying nothing is
  // better than showing a profile editor whose every save fails.
  if (unavailable || !id) return null;

  const picked = taste?.interests ?? [];
  const dirty = about.trim() !== (taste?.about ?? "").trim();

  return (
    <div className="space-y-3">
      <p className="section-label mb-1">What you&apos;re into</p>

      <div className="card-soft space-y-4 p-4">
        <div className="flex items-start gap-3">
          <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-teal-500" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-stone-900">Tune your events feed</p>
            <p className="text-xs text-stone-500">
              Tell us what you enjoy and we&apos;ll rank what&apos;s on around you to match. Only
              you can see this, and you can change or delete it any time.
            </p>
          </div>
        </div>

        {/* Chips */}
        <div className="flex flex-wrap gap-1.5">
          {chips.map((c) => {
            const on = picked.includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => toggleChip(c.id)}
                aria-pressed={on}
                className={`rounded-full border px-3 py-1.5 text-[13px] transition ${
                  on
                    ? "border-teal-500 bg-teal-50 font-medium text-teal-800"
                    : "border-stone-300 text-stone-600 hover:border-stone-400"
                }`}
              >
                <span aria-hidden>{c.emoji}</span> {c.label}
              </button>
            );
          })}
        </div>

        {/* The free text. This is the strongest signal, which is why it is a box
            the person owns rather than something only the chat can write. */}
        <div>
          <label htmlFor="taste-about" className="mb-1 block text-xs font-medium text-stone-600">
            In your own words
          </label>
          <textarea
            id="taste-about"
            value={about}
            onChange={(e) => setAbout(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="e.g. I have a 4-year-old and no car. Free things nearby are best, and I'd like to meet other parents."
            className="w-full resize-y rounded-xl border border-stone-300 px-3 py-2 text-sm text-stone-800 placeholder:text-stone-400 focus:border-teal-500 focus:outline-none"
          />
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              disabled={!dirty || saving}
              onClick={() => save({ about: about.trim() || null })}
              className="rounded-full bg-stone-900 px-3.5 py-1.5 text-[13px] font-semibold text-white transition hover:bg-stone-800 disabled:opacity-40"
            >
              {saving ? "Saving…" : dirty ? "Save" : "Saved"}
            </button>
            {savedAt > 0 && !dirty && !saving && (
              <span className="inline-flex items-center gap-1 text-xs text-teal-700">
                <Check className="h-3.5 w-3.5" /> Your feed has been updated
              </span>
            )}
          </div>
        </div>

        {/* Chat */}
        <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
          {messages.length > 0 && (
            <div ref={scroller} className="mb-2 max-h-56 space-y-2 overflow-y-auto" data-private>
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-[13px] ${
                    m.role === "user"
                      ? "ml-auto bg-stone-900 text-white"
                      : "bg-white text-stone-800 shadow-sm"
                  }`}
                >
                  {m.content}
                </div>
              ))}
              {thinking && (
                <div className="flex items-center gap-1.5 text-xs text-stone-500">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> thinking…
                </div>
              )}
            </div>
          )}
          <div className="flex items-center gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") send();
              }}
              placeholder={
                messages.length ? "Anything else?" : "Or just tell me — “I’m into live music”"
              }
              className="min-w-0 flex-1 rounded-full border border-stone-300 bg-white px-3.5 py-2 text-sm placeholder:text-stone-400 focus:border-teal-500 focus:outline-none"
              data-private
            />
            <button
              type="button"
              onClick={send}
              disabled={!draft.trim() || thinking}
              aria-label="Send"
              className="shrink-0 rounded-full bg-teal-600 p-2.5 text-white transition hover:bg-teal-700 disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>

        {(picked.length > 0 || taste?.about) && (
          <button
            type="button"
            onClick={forget}
            className="inline-flex items-center gap-1.5 text-xs text-stone-500 underline underline-offset-2 hover:text-red-600"
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete what&apos;s saved about me
          </button>
        )}
      </div>
    </div>
  );
}
