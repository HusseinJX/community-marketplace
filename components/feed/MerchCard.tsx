"use client";

import Link from "next/link";
import { Sparkles, ShoppingBag } from "lucide-react";

// Official WhatsLocal merch (XEN0) — a featured promo card injected into the
// Community Feed + directory grid. Vertical layout (hero image + content) so it
// sits cleanly among the member tiles. Swap MERCH_URL / MERCH_IMG when the real
// store + product shots are ready.
const MERCH_URL = "#";
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
          alt="WhatsLocal merch"
          className="absolute inset-0 h-full w-full object-cover opacity-90 transition duration-300 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-stone-900 via-stone-900/20 to-transparent" />
        <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-black/40 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-white ring-1 ring-white/20 backdrop-blur">
          <Sparkles className="h-3 w-3" /> Official merch
        </span>
        <span className="absolute bottom-3 left-4 text-2xl font-bold tracking-tight drop-shadow">
          XEN0
        </span>
      </div>

      <div className="flex flex-col gap-1.5 p-4">
        <h3 className="text-base font-semibold leading-tight">XEN0 × WhatsLocal</h3>
        <p className="text-sm text-stone-300">Limited-run tees, caps &amp; stickers.</p>
        <div className="flex items-center justify-between gap-2 pt-2">
          <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium text-stone-200 ring-1 ring-white/10">
            Coming soon
          </span>
          <Link
            href={MERCH_URL}
            className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-sm font-semibold text-stone-900 transition hover:bg-stone-100"
          >
            <ShoppingBag className="h-4 w-4" /> Shop
          </Link>
        </div>
      </div>
    </article>
  );
}
