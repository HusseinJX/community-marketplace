"use client";

import { useState } from "react";
import { Sparkles, X } from "lucide-react";
import { AssistantChat } from "@/components/messages/AssistantChat";

// Floating "WhatsLocal Assistant" — a sticky circle button bottom-right that
// expands into a full-screen chat, mirroring the resources guide (ResourceChat).
// It embeds the SAME general assistant that lived in the Messages tab and is
// wired to the Community Connector Agent brain (via /api/assistant/chat) — the
// one that also answers the SMS channel. Use it for account/profile help.
export function AssistantLauncher({
  title = "WhatsLocal Assistant",
  subtitle = "Ask me about your account, your profile, or anything local.",
}: {
  title?: string;
  subtitle?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {open && (
        // An expanded CARD, not full-screen: small margins on mobile (clearing
        // the bottom nav), and a fixed-size panel anchored bottom-right on desktop.
        <div
          className="fixed z-50 flex flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/10
                     inset-x-3 top-16 bottom-[calc(4.75rem+env(safe-area-inset-bottom))]
                     sm:inset-auto sm:right-6 sm:bottom-6 sm:top-auto sm:h-[min(640px,80vh)] sm:w-[400px]"
        >
          <div className="flex items-center justify-between bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-3 text-white">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <Sparkles className="h-5 w-5" /> {title}
              </p>
              <p className="mt-0.5 truncate text-xs text-white/80">{subtitle}</p>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="rounded-full p-1 text-white/80 transition hover:bg-white/20 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          {/* AssistantChat fills the remaining height (flex-1 min-h-0). */}
          <div className="flex min-h-0 flex-1 flex-col">
            <AssistantChat />
          </div>
        </div>
      )}

      {!open && (
        <div className="fixed right-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-40 sm:right-6 sm:bottom-6">
          <button
            onClick={() => setOpen(true)}
            aria-label={title}
            className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-lg ring-1 ring-black/5 transition hover:shadow-xl hover:brightness-110"
          >
            <Sparkles className="h-6 w-6" />
          </button>
        </div>
      )}
    </>
  );
}
