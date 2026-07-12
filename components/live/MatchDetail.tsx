"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, MapPin, ChevronRight } from "lucide-react";
import { eventEmoji, eventLabel, timeLeftLabel } from "@/lib/live-events";
import { fetchLiveBroadcasts, matchKeyOf } from "@/lib/demo-live-fixtures";
import { LiveMap } from "./LiveMap";
import type { LiveBroadcast } from "./types";

// A Zillow/Google-Maps-style page for one match: the places showing it as a
// listings column on the left, a map on the right. Each listing opens its
// /live/[id] page.
export function MatchDetail({ matchKey }: { matchKey: string }) {
  const router = useRouter();
  const key = decodeURIComponent(matchKey);
  const [all, setAll] = useState<LiveBroadcast[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchLiveBroadcasts().then((bcs) => {
      if (!cancelled) setAll(bcs);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const venues = useMemo(
    () => (all ?? []).filter((b) => matchKeyOf(b) === key),
    [all, key]
  );
  const first = venues[0];
  const mapped = useMemo(() => venues.filter((v) => v.latitude != null && v.longitude != null), [venues]);

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-4 md:px-8">
      {/* Back + header */}
      <button
        onClick={() => router.back()}
        className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-stone-500 hover:text-stone-800"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      {all === null ? (
        <p className="text-sm text-stone-500">Loading…</p>
      ) : venues.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white/60 p-12 text-center">
          <p className="text-base font-medium text-stone-800">Nobody&apos;s showing this right now.</p>
          <Link href="/" className="mt-2 inline-block text-sm font-medium text-rose-600 hover:text-rose-800">
            See what&apos;s live →
          </Link>
        </div>
      ) : (
        <>
          <div className="mb-4">
            <p className="text-xs font-medium text-stone-500">
              {eventEmoji(first.event_slug)} {eventLabel(first.event_slug, first.event_label)}
            </p>
            <h1 className="text-xl font-semibold tracking-tight text-stone-900">
              {first.whats_on || eventLabel(first.event_slug, first.event_label)}
            </h1>
            <p className="mt-0.5 text-sm text-stone-500">
              {venues.length} {venues.length === 1 ? "place" : "places"} showing it near you
            </p>
          </div>

          {/* Split: listings left, map right (map on top on mobile). */}
          <div className="grid gap-4 md:grid-cols-[1fr_42%]">
            {/* Map */}
            <div className="order-1 md:order-2">
              <div className="md:sticky md:top-20">
                {mapped.length > 0 ? (
                  <LiveMap broadcasts={mapped} />
                ) : (
                  <div className="flex h-64 items-center justify-center rounded-2xl border border-stone-200 bg-stone-50 text-sm text-stone-400">
                    No map locations
                  </div>
                )}
              </div>
            </div>

            {/* Listings */}
            <div className="order-2 space-y-3 md:order-1">
              {venues.map((v) => (
                <VenueListing key={v.id} v={v} />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function VenueListing({ v }: { v: LiveBroadcast }) {
  const place = [v.neighborhood, v.city].filter(Boolean).join(", ");
  const cover = v.image_urls?.[0];
  return (
    <Link
      href={`/live/${v.id}`}
      className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-white p-3 transition hover:border-rose-300 hover:shadow-sm"
    >
      {cover ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={cover} alt="" className="h-20 w-20 shrink-0 rounded-xl object-cover" />
      ) : (
        <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-3xl">
          {eventEmoji(v.event_slug)}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-semibold text-stone-900">{v.member_name || "Venue"}</p>
        {place && (
          <p className="mt-0.5 inline-flex items-center gap-1 text-sm text-stone-500">
            <MapPin className="h-3.5 w-3.5" /> {place}
          </p>
        )}
        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
          {v.supports_team && (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-700">
              🏳️ {v.supports_team}
            </span>
          )}
          <span className="font-medium text-rose-600">{timeLeftLabel(v.ends_at)}</span>
        </div>
      </div>
      <ChevronRight className="h-5 w-5 shrink-0 text-stone-400" />
    </Link>
  );
}
