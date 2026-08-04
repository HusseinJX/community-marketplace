"use client";

import { Sparkles, ShoppingBag } from "lucide-react";

// Official WhatsLocal merch (xen0) — a featured promo card injected into the
// Community Feed + directory grid. Vertical layout (hero image + content) so it
// sits cleanly among the member tiles. Swap MERCH_IMG when the real product
// shots are ready.
//
// target="_blank" ON PURPOSE — do not "fix" this to a same-tab link.
//
// *.whatslocal.ai is in the iOS shell's `allowNavigation`, so a same-tab link
// loads the store INSIDE the app webview. That sounds right and is a trap: the
// app has no browser chrome and swipe-back is not enabled on WKWebView, so once
// you're on the store there is no way back short of force-quitting. Auth gets
// away with staying in-webview because it returns you automatically; a store
// never does.
//
// With _blank, Capacitor hands the URL to the system browser, which has its own
// back affordance. Revisit once the native shell enables
// `allowsBackForwardNavigationGestures` (or we route this through
// @capacitor/browser for an in-app sheet with a Done button).
const MERCH_URL = "https://xen0.whatslocal.ai";
const MERCH_IMG =
  "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=1200&q=70";

export function MerchCard({ className }: { className?: string }) {
  return (
    <article
      className={`group flex h-full flex-col overflow-hidden rounded-2xl border border-stone-800 bg-stone-900 text-white shadow-sm ${className ?? ""}`}
    >
      <div className="relative min-h-[180px] flex-1 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={MERCH_IMG}
          alt="xen0 merch"
          className="absolute inset-0 h-full w-full object-cover opacity-90 transition duration-300 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-stone-900 via-stone-900/20 to-transparent" />
        <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-black/40 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-white ring-1 ring-white/20 backdrop-blur">
          <Sparkles className="h-3 w-3" /> Official merch
        </span>
        <span className="absolute bottom-3 left-4 text-xl font-bold tracking-tight drop-shadow">
          xen0
        </span>
      </div>

      <div className="flex flex-col gap-1.5 p-4">
        <h3 className="text-base font-semibold leading-tight">xen0 × WhatsLocal</h3>
        <p className="text-sm text-stone-300">Limited-run tees, caps &amp; stickers.</p>
        <div className="flex items-center justify-between gap-2 pt-2">
          <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium text-stone-200 ring-1 ring-white/10">
            Coming soon
          </span>
          <a
            href={MERCH_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-sm font-semibold text-stone-900 transition hover:bg-stone-100"
          >
            <ShoppingBag className="h-4 w-4" /> Shop
          </a>
        </div>
      </div>
    </article>
  );
}
