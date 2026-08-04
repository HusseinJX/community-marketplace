"use client";

// A community chat room. Gated on the same rule that surfaced it in the feed:
// you can read and post while you're inside the join radius, and the door closes
// again when you walk away. Starring is what survives leaving.
//
// UI-only: the transcript is demo content and a sent message is appended
// locally. No table, no polling, nothing leaves the tab.

import { useEffect, useMemo, useRef, useState } from "react";
import { Lock, MapPin, Send, Star, Users } from "lucide-react";
import { BackToHome } from "@/components/BackToHome";
import { useStarredChats } from "@/lib/community-saves";
import {
  type CommunityChat,
  type CommunityChatMessage,
  LOCATION_GATING,
  canEnter,
  distanceLabel,
  metresAway,
} from "@/lib/demo-community-chats";
import { useViewerPosition } from "@/lib/use-viewer-position";

// Stable per-name colour so the same neighbour reads the same down the thread.
const AVATAR_TONES = [
  "bg-rose-100 text-rose-700",
  "bg-amber-100 text-amber-700",
  "bg-emerald-100 text-emerald-700",
  "bg-sky-100 text-sky-700",
  "bg-violet-100 text-violet-700",
  "bg-teal-100 text-teal-700",
];
function toneFor(name: string): string {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return AVATAR_TONES[h % AVATAR_TONES.length];
}

function timeAgo(mins: number): string {
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}

export function CommunityChatRoom({ chat }: { chat: CommunityChat }) {
  const pos = useViewerPosition();
  const { isStarred, toggle } = useStarredChats();
  const [sent, setSent] = useState<CommunityChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const messages = useMemo(
    () => [...chat.messages].sort((a, b) => b.minsAgo - a.minsAgo).concat(sent),
    [chat.messages, sent]
  );

  // Keep the newest message in view as the thread grows.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: sent.length ? "smooth" : "auto", block: "end" });
  }, [sent.length]);

  const starred = isStarred(chat.id);
  // Gating off (LOCATION_GATING): the room is always open, so the locked screen
  // below is unreachable rather than removed.
  const away = LOCATION_GATING && pos.status === "ready" ? metresAway(chat, pos.coords) : null;
  const open = LOCATION_GATING ? pos.status === "ready" && canEnter(chat, pos.coords) : true;

  function send() {
    const body = draft.trim();
    if (!body) return;
    setSent((s) => [...s, { id: `local-${s.length}`, author: "You", minsAgo: 0, body }]);
    setDraft("");
  }

  return (
    // A chat is a fixed box, not a long page: the transcript scrolls inside it
    // and the composer sits at the bottom of the box, which ends exactly where
    // the bottom nav starts. Sized off --app-chrome (top nav + bottom nav +
    // safe areas) the same way the vendor inbox does it — a sticky composer
    // would sit *under* the fixed bottom nav instead.
    <div
      className="flex flex-col"
      style={{ height: "calc(100dvh - var(--app-chrome))" }}
    >
      {/* Header — its own back link, master-detail style (‹ Feed). */}
      <div className="shrink-0 border-b border-stone-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          {/* A room is reachable from the Feed tab and the Chats tab, so the
              back link names whichever one you actually came from. */}
          <BackToHome className="inline-flex items-center gap-1 text-sm font-medium text-stone-500 transition hover:text-stone-800" />

          <div className="ml-1 min-w-0 flex-1">
            <h1 className="flex items-center gap-1.5 truncate text-sm font-semibold text-stone-900">
              <span>{chat.emoji}</span>
              {chat.name}
            </h1>
            <p className="flex items-center gap-2 truncate text-[11px] text-stone-500">
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {chat.locationLabel}
              </span>
              {open && (
                <span className="inline-flex items-center gap-1 text-emerald-600">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  {chat.activeNow} here now
                </span>
              )}
            </p>
          </div>

          <button
            type="button"
            onClick={() => toggle(chat.id)}
            aria-pressed={starred}
            aria-label={starred ? "Remove star" : "Star this room"}
            className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition ${
              starred
                ? "border-amber-200 bg-amber-50 text-amber-500"
                : "border-stone-200 text-stone-400 hover:border-stone-300 hover:text-stone-600"
            }`}
          >
            <Star className={`h-4 w-4 ${starred ? "fill-amber-400" : ""}`} />
          </button>
        </div>
      </div>

      {/* Locked — you're too far away (or we don't know where you are). The room
          exists; the door doesn't open. Starring still works from here. */}
      {!open ? (
        <div className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center overflow-y-auto px-6 py-16 text-center">
          <div className={`mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br ${chat.gradient}`}>
            <Lock className="h-7 w-7 text-white" />
          </div>
          <h2 className="text-lg font-semibold text-stone-900">You&apos;re not close enough</h2>
          <p className="mt-2 text-sm leading-relaxed text-stone-600">
            {pos.status === "unavailable"
              ? "Turn on location to see whether you're near this room."
              : `This room only opens within ${chat.joinRadiusM} m of ${chat.locationLabel}.`}
            {away !== null && (
              <>
                {" "}
                You&apos;re <span className="font-semibold text-stone-900">{distanceLabel(away)}</span>.
              </>
            )}
          </p>

          <button
            type="button"
            onClick={() => toggle(chat.id)}
            className={`mt-6 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition ${
              starred
                ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
                : "bg-stone-900 text-white hover:bg-stone-800"
            }`}
          >
            <Star className={`h-4 w-4 ${starred ? "fill-amber-500" : ""}`} />
            {starred ? "Starred — it's on your profile" : "Star it for when you're nearby"}
          </button>
        </div>
      ) : (
        <>
          {/* Transcript — the only scrolling region on the page. */}
          <div className="mx-auto w-full max-w-2xl flex-1 space-y-3 overflow-y-auto px-4 py-5">
            <div className="mb-4 flex items-center gap-2 rounded-xl bg-stone-50 px-3 py-2.5 text-xs text-stone-500">
              <Users className="h-3.5 w-3.5 shrink-0" />
              <span>
                {chat.memberCount} neighbours have been in this room.
                {LOCATION_GATING
                  ? " Messages stay with the place — walk away and it closes."
                  : " Messages stay with the place."}
              </span>
            </div>

            {messages.map((m) =>
              m.system ? (
                <p key={m.id} className="py-1 text-center text-[11px] text-stone-400">
                  {m.body}
                </p>
              ) : (
                <div key={m.id} className={`flex gap-2.5 ${m.author === "You" ? "flex-row-reverse" : ""}`}>
                  <span
                    className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                      m.author === "You" ? "bg-stone-900 text-white" : toneFor(m.author)
                    }`}
                  >
                    {m.author.slice(0, 1).toUpperCase()}
                  </span>
                  <div className={`min-w-0 max-w-[80%] ${m.author === "You" ? "text-right" : ""}`}>
                    <p className="mb-0.5 text-[11px] text-stone-400">
                      {m.author === "You" ? "You" : m.author} · {timeAgo(m.minsAgo)}
                    </p>
                    <p
                      className={`inline-block rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                        m.author === "You"
                          ? "rounded-tr-sm bg-stone-900 text-white"
                          : "rounded-tl-sm bg-stone-100 text-stone-800"
                      }`}
                    >
                      {m.body}
                    </p>
                  </div>
                </div>
              )
            )}
            <div ref={endRef} />
          </div>

          {/* Composer — the last child of the fixed box, so it lands directly
              above the bottom nav without overlapping it. */}
          <div className="shrink-0 border-t border-stone-200 bg-white/95 backdrop-blur">
            <div className="mx-auto flex max-w-2xl items-end gap-2 px-4 py-3">
              <textarea
                rows={1}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder={`Message ${chat.name}…`}
                className="max-h-32 min-h-[2.75rem] flex-1 resize-none rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-stone-400"
              />
              <button
                type="button"
                onClick={send}
                disabled={!draft.trim()}
                aria-label="Send"
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-stone-900 text-white transition hover:bg-stone-800 disabled:opacity-30"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
