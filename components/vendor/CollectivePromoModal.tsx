"use client";

import { useEffect, useState } from "react";
import { X, ArrowRight, MessageSquare } from "lucide-react";

const SEEN_KEY = "wl_collective_promo_seen";
// Text-to-join number (matches components/SmsBanner.tsx + app/sms).
const SMS_VANITY = "+1-LOCAL-REACH"; // spells 562-257-3224
const SMS_NUMBER_TEL = "+15622573224";

export function CollectivePromoModal() {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Auto-open once per browser. Reopenable via the floating button below.
  useEffect(() => {
    if (localStorage.getItem(SEEN_KEY) !== "1") {
      const t = setTimeout(() => setOpen(true), 600);
      return () => clearTimeout(t);
    }
  }, []);

  function close() {
    setOpen(false);
    setExpanded(false);
    localStorage.setItem(SEEN_KEY, "1");
  }

  return (
    <>
      {/* Reopen button (always available) */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-24 right-4 z-40 inline-flex items-center gap-2 rounded-full bg-[#2d3eb8] px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:bg-[#25329a]"
        >
          <MessageSquare className="h-4 w-4" /> See how it works
        </button>
      )}

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4"
          style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)" }}
          onClick={close}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative flex h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-[#f1ead9] shadow-2xl transition-all"
          >
            {/* Close */}
            <button
              type="button"
              onClick={close}
              aria-label="Close"
              className="absolute right-3 top-3 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/10 text-stone-700 backdrop-blur transition hover:bg-black/20"
            >
              <X className="h-5 w-5" />
            </button>

            {/* The design (iframe-isolated). Swaps to the full page on expand. */}
            <iframe
              key={expanded ? "full" : "hero"}
              src={`/vendor-collective.html?view=${expanded ? "full" : "hero"}`}
              title="How WhatsLocal works"
              className="w-full flex-1 border-0"
            />

            {/* CTA chrome — hidden once expanded (the full page has its own CTAs) */}
            {!expanded && (
              <div className="shrink-0 space-y-3 border-t border-stone-300/60 bg-[#f1ead9] px-5 py-4">
                <p className="text-center text-sm text-stone-700">
                  Your AI concierge lives in your texts — open the app to jump
                  into collabs.
                </p>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => setExpanded(true)}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#2d3eb8] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#25329a]"
                  >
                    Learn more <ArrowRight className="h-4 w-4" />
                  </button>
                  <p className="text-center text-xs text-stone-600">
                    or{" "}
                    <a
                      href={`sms:${SMS_NUMBER_TEL}`}
                      className="font-semibold text-[#2d3eb8] underline"
                    >
                      Text {SMS_VANITY} to join
                    </a>
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
