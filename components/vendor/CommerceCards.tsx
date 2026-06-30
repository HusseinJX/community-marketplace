"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Package, ShoppingCart, Calendar, ArrowRight, Lock } from "lucide-react";

const STORAGE_KEY = "wl_commerce_enabled";

// Quick-access metrics + the My Products / My Events buttons, with a dev toggle
// that enables/disables the commerce (Products + Orders) surfaces. Default ON —
// flip the toggle off to lock them (instead of them being permanently locked in
// demo). Events are always available.
export function CommerceCards({ orderCount }: { orderCount: number }) {
  const [enabled, setEnabled] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v !== null) setEnabled(v === "1");
    setReady(true);
  }, []);

  function toggle() {
    setEnabled((e) => {
      const next = !e;
      localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  }

  const locked = ready && !enabled;

  const cards = [
    { label: "Products", value: "3", href: "/vendor/products", icon: Package, locked },
    { label: "Orders", value: orderCount > 0 ? String(orderCount) : "—", href: "/vendor/orders", icon: ShoppingCart, locked },
    { label: "Events", value: "—", href: "/vendor/events", icon: Calendar, locked: false },
  ];

  return (
    <>
      {/* Commerce toggle */}
      <div className="flex items-center justify-between rounded-xl border border-stone-200 bg-white px-4 py-3">
        <div>
          <p className="text-sm font-medium text-stone-900">Commerce</p>
          <p className="text-xs text-stone-500">Enable Products &amp; Orders for this account.</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={toggle}
          className={
            "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition " +
            (enabled ? "bg-indigo-500" : "bg-stone-300")
          }
        >
          <span
            className={
              "inline-block h-5 w-5 transform rounded-full bg-white shadow transition " +
              (enabled ? "translate-x-5" : "translate-x-0.5")
            }
          />
        </button>
      </div>

      {/* Quick access — compact metric grid */}
      <div>
        <p className="section-label mb-3">Quick access</p>
        <div className="grid grid-cols-3 gap-2">
          {cards.map((card) => {
            const Icon = card.icon;
            if (card.locked) {
              return (
                <div
                  key={card.label}
                  title="Turn on Commerce to use this"
                  className="card-soft flex cursor-not-allowed flex-col items-center gap-1 p-3 text-center opacity-60"
                >
                  <Icon className="h-5 w-5 text-stone-300" />
                  <span className="text-[11px] font-medium leading-tight text-stone-400">{card.label}</span>
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-stone-400">
                    <Lock className="h-3 w-3" /> Off
                  </span>
                </div>
              );
            }
            return (
              <Link
                key={card.label}
                href={card.href}
                className="card-soft card-hover flex flex-col items-center gap-1 p-3 text-center"
              >
                <Icon className="h-5 w-5 text-indigo-500" />
                <span className="text-[11px] font-medium leading-tight text-stone-500">{card.label}</span>
                <span className="text-base font-semibold text-stone-900">{card.value}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Manage entry buttons */}
      <div className="grid gap-3 sm:grid-cols-2">
        {locked ? (
          <div
            title="Turn on Commerce to use this"
            className="card-soft flex cursor-not-allowed items-center justify-between p-5 opacity-60"
          >
            <span className="flex items-center gap-3">
              <Package className="h-5 w-5 text-stone-300" />
              <span className="text-sm font-semibold text-stone-400">My Products</span>
            </span>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-stone-400">
              <Lock className="h-3.5 w-3.5" /> Off
            </span>
          </div>
        ) : (
          <Link href="/vendor/products" className="card-soft card-hover flex items-center justify-between p-5">
            <span className="flex items-center gap-3">
              <Package className="h-5 w-5 text-indigo-500" />
              <span className="text-sm font-semibold text-stone-900">My Products</span>
            </span>
            <ArrowRight className="h-4 w-4 text-stone-400" />
          </Link>
        )}
        <Link href="/vendor/events" className="card-soft card-hover flex items-center justify-between p-5">
          <span className="flex items-center gap-3">
            <Calendar className="h-5 w-5 text-indigo-500" />
            <span className="text-sm font-semibold text-stone-900">My Events</span>
          </span>
          <ArrowRight className="h-4 w-4 text-stone-400" />
        </Link>
      </div>
    </>
  );
}
