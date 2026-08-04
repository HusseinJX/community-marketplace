"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FEED, FEED_COORDS, PLACES, SOURCE_META, distanceMi, nearestPlace, type FeedItem, type Place } from "@/lib/prototype-data";

const FILTERS = ["Today", "This week", "Near me"] as const;
const SF = PLACES.find((p) => p.id === "sf")!; // our only live city right now
const SF_CENTER = { lat: 37.7749, lng: -122.4194 }; // distance ref when location is unknown

export default function PrototypeFeed() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("This week");
  const [rsvpd, setRsvpd] = useState<Record<string, boolean>>({});

  // Auto-detect the nearest populated city. `near` = nearest city we've added
  // (may be planned); `active` = nearest city we actually cover (live).
  const [near, setNear] = useState<Place | null>(null);
  const [active, setActive] = useState<Place | null>(null);
  const [located, setLocated] = useState(false);
  const [interested, setInterested] = useState(false);
  // The person's position — the reference point for "how far" on each card.
  const [me, setMe] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocated(true);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setMe({ lat: latitude, lng: longitude });
        setNear(nearestPlace(latitude, longitude)?.place ?? null);
        setActive(nearestPlace(latitude, longitude, { activeOnly: true })?.place ?? null);
        setLocated(true);
      },
      () => setLocated(true), // denied / unavailable → fall back to default
      { timeout: 8000 },
    );
  }, []);

  // Distance from the person (or SF center when we don't have their location).
  const distFor = (id: string): number | null => {
    const c = FEED_COORDS[id];
    if (!c) return null;
    return distanceMi(me ?? SF_CENTER, c);
  };

  // We serve them here when the nearest populated city is activated. Before we
  // locate (or on denial), default to our only live city so the feed reads.
  const activeCity = active ?? (near?.status === "live" ? near : null);
  const servedHere = !located || !near || near.status === "live";

  return (
    <div className="mx-auto w-full max-w-md">
      {/* Location header */}
      {servedHere ? (
        <div className="mb-3">
          <p className="text-xs font-medium text-stone-500">Happening around you</p>
          <h1 className="flex items-center gap-1 text-2xl font-extrabold tracking-tight">
            📍 Near you in {near?.status === "live" ? near.city : "San Francisco"}
          </h1>
        </div>
      ) : (
        <div className="mb-4 rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200">
          <h1 className="text-lg font-extrabold tracking-tight text-amber-900">
            We&apos;re only in {(activeCity ?? SF).city} right now
          </h1>
          <p className="mt-1 text-sm text-amber-800">
            WhatsLocal isn&apos;t live in <b>{near!.city}</b> yet — the nearest city we cover is{" "}
            {(activeCity ?? SF).city}.
          </p>
          {interested ? (
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1.5 text-sm font-semibold text-emerald-700">
              ✓ Thanks! We&apos;ll let you know when {near!.city} goes live.
            </p>
          ) : (
            <button
              onClick={() => setInterested(true)}
              className="mt-3 w-full rounded-full bg-stone-900 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-stone-800"
            >
              Show interest in bringing WhatsLocal to {near!.city}
            </button>
          )}
        </div>
      )}

      {/* Filter chips */}
      <div className="mb-4 flex gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${
              filter === f ? "bg-stone-900 text-white" : "bg-white text-stone-600 ring-1 ring-stone-200"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Host CTA */}
      <Link
        href="/prototype/host"
        className="mb-4 flex items-center justify-between rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-3 text-white"
      >
        <div>
          <p className="text-sm font-bold">Have an idea? Host your own.</p>
          <p className="text-xs text-white/80">Find a local space & fill it →</p>
        </div>
        <span className="text-2xl">🗓️</span>
      </Link>

      {/* Feed */}
      <div className="space-y-3">
        {FEED.map((item) => (
          <Card
            key={item.id}
            item={item}
            distanceMi={distFor(item.id)}
            rsvpd={!!rsvpd[item.id]}
            onRsvp={() => setRsvpd((s) => ({ ...s, [item.id]: !s[item.id] }))}
          />
        ))}
      </div>

      <p className="mt-6 text-center text-xs text-stone-400">
        Feed seeded from local SF sources · updated 12 min ago
      </p>
    </div>
  );
}

function Card({
  item,
  distanceMi,
  rsvpd,
  onRsvp,
}: {
  item: FeedItem;
  distanceMi: number | null;
  rsvpd: boolean;
  onRsvp: () => void;
}) {
  const src = SOURCE_META[item.source.kind];
  const isEvent = item.kind === "event";
  const going = (item.rsvps ?? 0) + (rsvpd ? 1 : 0);
  const miles = distanceMi == null ? null : distanceMi < 0.1 ? "<0.1 mi" : `${distanceMi.toFixed(1)} mi away`;

  return (
    <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-stone-200">
      {/* Cover */}
      <div className="relative h-28 w-full" style={{ background: item.gradient }}>
        <span className="absolute left-3 top-3 text-3xl drop-shadow">{item.emoji}</span>
        {item.tag && (
          <span className="absolute right-3 top-3 rounded-full bg-black/25 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur">
            {item.tag}
          </span>
        )}
        <span
          className={`absolute bottom-3 left-3 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
            isEvent ? "bg-white text-stone-900" : "bg-black/30 text-white backdrop-blur"
          }`}
        >
          {isEvent ? "Event" : "Announcement"}
        </span>
      </div>

      {/* Body */}
      <div className="p-3">
        <h3 className="text-base font-bold leading-tight">{item.title}</h3>
        <p className="mt-0.5 text-sm text-stone-500">
          {item.when} · {item.where}
        </p>
        {miles && (
          <p className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-indigo-600">
            📍 {miles}
          </p>
        )}
        {item.blurb && <p className="mt-1.5 text-sm text-stone-600">{item.blurb}</p>}

        {/* Attribution */}
        <div className="mt-2.5 flex items-center gap-1.5">
          <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${src.tint}`}>
            {src.emoji} {src.label}
          </span>
          <span className="text-[11px] text-stone-400">via {item.source.via}</span>
        </div>

        {/* Actions */}
        {isEvent ? (
          <div className="mt-3 flex items-center justify-between">
            <div className="text-xs text-stone-500">
              <span className="font-semibold text-stone-800">{going}</span> going
              {item.cap ? ` · ${item.cap - going} spots left` : ""}
            </div>
            <button
              onClick={onRsvp}
              className={`rounded-full px-4 py-1.5 text-sm font-bold transition ${
                rsvpd ? "bg-emerald-100 text-emerald-700" : "bg-stone-900 text-white"
              }`}
            >
              {rsvpd ? "✓ Going" : "RSVP"}
            </button>
          </div>
        ) : (
          <div className="mt-3 flex gap-2">
            <button className="rounded-full bg-stone-100 px-4 py-1.5 text-sm font-semibold text-stone-700">
              🔖 Save
            </button>
            <button className="rounded-full bg-stone-100 px-4 py-1.5 text-sm font-semibold text-stone-700">
              ↗ Share
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
