"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, MapPin, Radio, Calendar } from "lucide-react";
import { eventEmoji, eventLabel, timeLeftLabel, isLive } from "@/lib/live-events";
import { streamEmbed } from "@/lib/embed";
import { SaveButton } from "./SaveButton";
import { LiveMap } from "./LiveMap";
import { MemoriesGrid } from "@/components/posts/MemoriesGrid";
import type { LiveBroadcast } from "./types";

export function BroadcastDetail({ id }: { id: string }) {
  const router = useRouter();
  const [b, setB] = useState<LiveBroadcast | null>(null);
  const [loading, setLoading] = useState(true);
  const [host, setHost] = useState<string>("");
  const [nowTs, setNowTs] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const finish = (bc: LiveBroadcast | null) => {
      if (cancelled) return;
      setHost(window.location.hostname);
      setNowTs(Date.now());
      setB(bc);
      setLoading(false);
    };
    fetch(`/api/broadcasts/view/${id}`)
      .then((r) => (r.ok ? r.json() : { broadcast: null }))
      .then((d) => finish(d.broadcast ?? null))
      .catch(() => finish(null));
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10 md:px-8">
        <div className="h-64 animate-pulse rounded-2xl bg-stone-100" />
      </div>
    );
  }

  if (!b) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center md:px-8">
        <p className="text-base font-medium text-stone-800">This broadcast isn&apos;t live anymore.</p>
        <Link href="/live" className="mt-2 inline-block text-sm font-medium text-rose-600 hover:text-rose-800">
          See what&apos;s live now →
        </Link>
      </div>
    );
  }

  const live = isLive(b, nowTs);
  const scheduled = Date.parse(b.starts_at) > nowTs;
  const embed = streamEmbed(b.livestream_url, host);
  const place = [b.neighborhood, b.city].filter(Boolean).join(", ");

  return (
    <div className="mx-auto max-w-4xl px-4 pb-20 md:px-8">
      <div className="pt-6">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-900"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
      </div>

      {/* Header */}
      <div className="mt-4 flex items-center gap-2">
        {live ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-600 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
            <Radio className="h-3.5 w-3.5" /> Live · {timeLeftLabel(b.ends_at)}
          </span>
        ) : scheduled ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-600 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
            <Calendar className="h-3.5 w-3.5" />{" "}
            {new Date(b.starts_at).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
          </span>
        ) : (
          <span className="rounded-full bg-stone-200 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-stone-600">Ended</span>
        )}
        <span className="text-sm font-medium text-stone-500">
          {eventEmoji(b.event_slug)} {eventLabel(b.event_slug, b.event_label)}
        </span>
      </div>

      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-stone-900 md:text-4xl">
        {b.whats_on || eventLabel(b.event_slug, b.event_label)}
      </h1>

      <div className="mt-2 flex flex-wrap items-center gap-3">
        <Link href={`/members/${b.member_id}`} className="text-base font-medium text-indigo-600 hover:text-indigo-800">
          {b.member_name || "View venue"}
        </Link>
        {place && (
          <span className="inline-flex items-center gap-1 text-sm text-stone-500">
            <MapPin className="h-4 w-4" /> {place}
          </span>
        )}
        {b.supports_team && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-sm font-medium text-emerald-700">
            🏳️ Rooting for {b.supports_team}
          </span>
        )}
        <SaveButton broadcastId={b.id} initialSaved={b.saved} initialCount={b.save_count} />
      </div>

      {b.note && <p className="mt-4 text-stone-700">{b.note}</p>}

      {/* Livestream */}
      {embed ? (
        <div className="mt-6 aspect-video w-full overflow-hidden rounded-2xl bg-black">
          <iframe
            src={embed.src}
            title="Livestream"
            className="h-full w-full"
            allow="autoplay; fullscreen; encrypted-media"
            allowFullScreen
          />
        </div>
      ) : b.livestream_url ? (
        <a
          href={b.livestream_url}
          target="_blank"
          rel="noreferrer"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-stone-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-stone-800"
        >
          <Radio className="h-4 w-4" /> Watch the livestream
        </a>
      ) : null}

      {/* Vibe gallery */}
      {b.image_urls?.length > 0 && (
        <div className="mt-6">
          <p className="section-label mb-2">The vibe right now</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {b.image_urls.map((url) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={url} src={url} alt="vibe" className="h-40 w-full rounded-xl object-cover" />
            ))}
          </div>
        </div>
      )}

      {/* Community memories — fans' photos tagged to this broadcast */}
      <div className="mt-6">
        <MemoriesGrid eventId={b.id} title="From the crowd" subtitle="Tagged here" />
      </div>

      {/* Map */}
      {typeof b.latitude === "number" && typeof b.longitude === "number" && (
        <div className="mt-6">
          <p className="section-label mb-2">Where</p>
          <LiveMap broadcasts={[b]} />
        </div>
      )}

      <div className="mt-8">
        <Link
          href={`/live?event=${b.event_slug}`}
          className="text-sm font-medium text-rose-600 hover:text-rose-800"
        >
          More places showing {eventLabel(b.event_slug, b.event_label)} →
        </Link>
      </div>
    </div>
  );
}
