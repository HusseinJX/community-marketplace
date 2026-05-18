"use client";

import { useRef, useState } from "react";
import { ExternalLink, Send } from "lucide-react";

type Msg = {
  id: string;
  author: string;
  initials: string;
  color: string;
  time: string;
  text: string;
  you?: boolean;
};

export function GroupChat({ communityName }: { communityName: string }) {
  const seed: Msg[] = [
    {
      id: "m1",
      author: "Maya R.",
      initials: "MR",
      color: "bg-rose-100 text-rose-700",
      time: "9:14 AM",
      text: `Morning everyone! Reminder that the ${communityName} weekly drop is this Saturday — bring totes 🛍️`,
    },
    {
      id: "m2",
      author: "Andre T.",
      initials: "AT",
      color: "bg-amber-100 text-amber-700",
      time: "9:22 AM",
      text: "I can drive the van from Slauson at 8:30 if anyone needs a ride.",
    },
    {
      id: "m3",
      author: "Priya S.",
      initials: "PS",
      color: "bg-indigo-100 text-indigo-700",
      time: "10:01 AM",
      text: "Sweet — putting together a flyer in Spanish + English. Will post a draft tonight.",
    },
    {
      id: "m4",
      author: "Jordan K.",
      initials: "JK",
      color: "bg-emerald-100 text-emerald-700",
      time: "10:48 AM",
      text: "Big up to whoever brought the masa last week, the tamales were unreal 🌽",
    },
  ];
  const [messages, setMessages] = useState<Msg[]>(seed);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setMessages((prev) => [
      ...prev,
      {
        id: `you-${Date.now()}`,
        author: "You",
        initials: "YO",
        color: "bg-stone-900 text-white",
        time: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
        text,
        you: true,
      },
    ]);
    setDraft("");
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const channel = communityName.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  return (
    <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
      <a
        href="https://spaceagevision.world"
        target="_blank"
        rel="noreferrer"
        className="group flex items-center justify-between gap-3 border-b border-stone-100 bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2.5 text-sm font-medium text-white transition hover:from-indigo-700 hover:to-violet-700"
      >
        <span>Be a part of the larger conversation</span>
        <ExternalLink className="h-4 w-4 transition group-hover:translate-x-0.5" />
      </a>

      <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          <div className="text-sm font-medium text-stone-800">#{channel}</div>
        </div>
        <div className="text-xs text-stone-500">
          {messages.length} messages · 124 members
        </div>
      </div>

      <div className="max-h-96 space-y-4 overflow-y-auto px-4 py-4">
        {messages.map((m) => (
          <div key={m.id} className={`flex gap-3 ${m.you ? "flex-row-reverse" : ""}`}>
            <div className={`flex h-8 w-8 flex-none items-center justify-center rounded-full text-xs font-semibold ${m.color}`}>
              {m.initials}
            </div>
            <div className={`max-w-[80%] ${m.you ? "text-right" : ""}`}>
              <div className="flex items-baseline gap-2 text-xs text-stone-500">
                <span className="font-medium text-stone-700">{m.author}</span>
                <span>{m.time}</span>
              </div>
              <div
                className={
                  "mt-1 inline-block rounded-2xl px-3.5 py-2 text-sm leading-relaxed " +
                  (m.you ? "bg-indigo-600 text-white" : "bg-stone-100 text-stone-800")
                }
              >
                {m.text}
              </div>
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={send} className="flex items-center gap-2 border-t border-stone-100 px-3 py-3">
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={`Message ${communityName}…`}
          className="flex-1 rounded-full border border-stone-200 bg-stone-50 px-4 py-2 text-sm text-stone-800 placeholder:text-stone-400 focus:border-indigo-300 focus:bg-white focus:outline-none"
        />
        <button
          type="submit"
          disabled={!draft.trim()}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-indigo-600 text-white transition hover:bg-indigo-700 disabled:bg-stone-200 disabled:text-stone-400"
          aria-label="Send"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
