"use client";

import { useState } from "react";
import { MoreVertical, Flag, Ban, Loader2, Check } from "lucide-react";
import { useAuth } from "@clerk/nextjs";

// Report / Block controls on a post (App Store 1.2). Reporting flags the content
// for review; blocking hides everything from that author immediately. Both call
// `onDone` so the caller can drop the post from view right away. Takes plain
// fields so it works from both the memories lightbox and the home-feed card.
const REASONS = [
  "Spam or scam",
  "Harassment or hate",
  "Nudity or sexual content",
  "Violence or threats",
  "Something else",
];

export function PostModerationMenu({
  postId,
  authorId,
  authorName,
  onDone,
}: {
  postId: string;
  authorId: string | null;
  authorName: string | null;
  onDone?: () => void;
}) {
  const { isSignedIn } = useAuth();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"menu" | "report">("menu");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  async function report(reason: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/posts/${postId}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, authorId }),
      });
      if (res.status === 401) {
        setDone("Sign in to report.");
      } else {
        setDone("Thanks — we’ll review this within 24 hours.");
        setTimeout(() => onDone?.(), 900);
      }
    } catch {
      setDone("Couldn’t send the report.");
    } finally {
      setBusy(false);
    }
  }

  async function block() {
    setBusy(true);
    try {
      const res = await fetch("/api/moderation/block", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ authorId }),
      });
      if (res.status === 401) {
        setDone("Sign in to block.");
      } else {
        setDone(`Blocked. You won’t see ${authorName || "this user"} again.`);
        setTimeout(() => onDone?.(), 900);
      }
    } catch {
      setDone("Couldn’t block this user.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => {
          setOpen((o) => !o);
          setMode("menu");
          setDone(null);
        }}
        aria-label="Post options"
        className="rounded-full p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
      >
        <MoreVertical className="h-5 w-5" />
      </button>

      {open && (
        <>
          {/* click-away */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-1 w-60 overflow-hidden rounded-xl border border-stone-200 bg-white py-1 shadow-lg">
            {done ? (
              <div className="flex items-center gap-2 px-3 py-3 text-[13px] text-stone-700">
                <Check className="h-4 w-4 shrink-0 text-emerald-500" /> {done}
              </div>
            ) : busy ? (
              <div className="flex items-center gap-2 px-3 py-3 text-[13px] text-stone-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Working…
              </div>
            ) : mode === "menu" ? (
              <>
                {!isSignedIn && (
                  <p className="px-3 pb-1 pt-1 text-[11px] text-stone-400">Sign in to report or block.</p>
                )}
                <button
                  onClick={() => setMode("report")}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] text-stone-700 hover:bg-stone-50"
                >
                  <Flag className="h-4 w-4 text-stone-400" /> Report post
                </button>
                <button
                  onClick={block}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] text-rose-600 hover:bg-rose-50"
                >
                  <Ban className="h-4 w-4" /> Block {authorName || "this user"}
                </button>
              </>
            ) : (
              <>
                <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-stone-400">
                  Why are you reporting this?
                </p>
                {REASONS.map((r) => (
                  <button
                    key={r}
                    onClick={() => report(r)}
                    className="flex w-full items-center px-3 py-2 text-left text-[13px] text-stone-700 hover:bg-stone-50"
                  >
                    {r}
                  </button>
                ))}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
