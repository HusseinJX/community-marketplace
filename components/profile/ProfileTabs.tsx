"use client";

import { useState, type ReactNode } from "react";

type Key = "posts" | "products" | "events";

/**
 * Posts · Products · Events — one switch above the profile's grid, one panel
 * at a time.
 *
 * The panels are rendered by the server page and handed in, so every panel is
 * in the HTML and switching is instant; this only decides which one shows.
 * A panel passed as null gets its own "nothing yet" line rather than a missing
 * tab — the switch is the same on every profile, so a visitor learns it once.
 */
export function ProfileTabs({
  posts,
  products,
  events,
}: {
  posts: ReactNode;
  products: ReactNode | null;
  /** Omit (undefined) to drop the Events tab entirely — organizers. */
  events?: ReactNode | null;
}) {
  const [tab, setTab] = useState<Key>("posts");

  const tabs: { key: Key; label: string }[] = [
    { key: "posts", label: "Posts" },
    { key: "products", label: "Products" },
    ...(events !== undefined ? [{ key: "events" as const, label: "Events" }] : []),
  ];

  const panel = tab === "posts" ? posts : tab === "products" ? products : events;

  return (
    <section>
      <div role="radiogroup" aria-label="Show" className="mb-4 flex justify-center">
        <div className="inline-flex rounded-full bg-stone-100 p-0.5 text-[13px] font-medium">
          {tabs.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={tab === key}
              onClick={() => setTab(key)}
              className={
                "rounded-full px-4 py-1.5 transition " +
                (tab === key ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-700")
              }
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {panel ?? (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white px-6 py-10 text-center">
          <p className="text-sm text-stone-500">
            {tab === "products" ? "No products to show yet." : "No events to show yet."}
          </p>
        </div>
      )}
    </section>
  );
}
