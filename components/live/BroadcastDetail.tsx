"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MapPin, Radio, Calendar, Camera, ArrowLeft, Users } from "lucide-react";
import { eventEmoji, eventLabel, timeLeftLabel, isLive } from "@/lib/live-events";
import { streamEmbed } from "@/lib/embed";
import { SaveButton } from "./SaveButton";
import { LiveMap } from "./LiveMap";
import { MemoriesGrid } from "@/components/posts/MemoriesGrid";
import { ShareMenu } from "@/components/ShareMenu";
import { useBroadcast } from "@/lib/data-hooks";
import { matchKeyOf } from "@/lib/demo-live-fixtures";

export function BroadcastDetail({ id }: { id: string }) {
  // Cached per-id — back/forward and re-open resolve instantly.
  const { broadcast: b, loading } = useBroadcast(id);
  const [host, setHost] = useState<string>("");
  const [nowTs, setNowTs] = useState(0);

  // Client-only values for share URLs and live/ended computation.
  useEffect(() => {
    setHost(window.location.hostname);
    setNowTs(Date.now());
  }, []);

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
        {/* "/" is the Products tab now, and /live redirects there — so this
            has to name the tab that actually holds the live feed. */}
        <Link href="/?tab=feed" className="mt-2 inline-block text-sm font-medium text-rose-600 hover:text-rose-800">
          See what&apos;s live now →
        </Link>
      </div>
    );
  }

  const live = isLive(b, nowTs);
  const scheduled = Date.parse(b.starts_at) > nowTs;
  const embed = streamEmbed(b.livestream_url, host);
  const place = [b.neighborhood, b.city].filter(Boolean).join(", ");

  const matchHref = `/live/match/${encodeURIComponent(matchKeyOf(b))}`;
  const cover = b.image_urls?.[0];

  return (
    <div className="mx-auto max-w-4xl px-4 pb-24 pt-4 md:px-8">
      {/* Back to the MATCH, named. This page is one venue out of a list, and
          the list is where the reader came from and where they go if this one
          is too far — the master-detail rule the rest of the app follows. */}
      <Link
        href={matchHref}
        className="inline-flex items-center gap-1.5 text-[14px] font-medium text-stone-500 transition hover:text-stone-900"
      >
        <ArrowLeft className="h-4 w-4" /> Everywhere showing{" "}
        {b.whats_on || eventLabel(b.event_slug, b.event_label)}
      </Link>

      {/* The venue's own photo, if it sent one. A live broadcast is a claim
          about a room, and the photo of the room is the most persuasive thing
          on the page — it was three sections down in a "vibe gallery". */}
      {cover && (
        <div className="mt-3 overflow-hidden rounded-2xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={cover} alt="" className="h-48 w-full object-cover sm:h-64" />
        </div>
      )}

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

      {/* THE VENUE is the title here, not the matchup. You already know which
          game you're chasing — you arrived from its page — and what you're
          deciding now is whether to go to THIS bar. The matchup stays as the
          line under it. */}
      <h1 className="mt-2 text-[28px] font-bold leading-tight tracking-tight text-stone-900 sm:text-4xl">
        {b.member_name || "This venue"}
      </h1>
      <p className="mt-1 text-[15px] text-stone-600">
        Showing{" "}
        <span className="font-semibold text-stone-900">
          {b.whats_on || eventLabel(b.event_slug, b.event_label)}
        </span>
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-[14px] text-stone-500">
        {place && (
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="h-4 w-4" /> {place}
          </span>
        )}
        {b.supports_team && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[13px] font-medium text-emerald-700">
            <Users className="h-3.5 w-3.5" /> Backing {b.supports_team}
          </span>
        )}
      </div>

      {b.note && <p className="mt-3 text-[15px] leading-relaxed text-stone-700">{b.note}</p>}

      {/* The two things to DO, on one row and above everything else. Save and
          share were sitting in the middle of a wrapped line of metadata, at the
          same weight as the neighbourhood name. */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Link
          href={`/members/${b.member_id}`}
          className="inline-flex items-center justify-center rounded-full bg-stone-900 px-5 py-2.5 text-[14px] font-semibold text-white transition hover:bg-stone-800"
        >
          View venue
        </Link>
        <SaveButton broadcastId={b.id} initialSaved={b.saved} initialCount={b.save_count} />
        <ShareMenu title={b.whats_on || eventLabel(b.event_slug, b.event_label)} />
      </div>

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

      {/* The rest of the venue's photos. The first one is the hero above, so
          it is skipped here rather than shown twice. */}
      {b.image_urls.length > 1 && (
        <div className="mt-8">
          <p className="section-label mb-2">Inside right now</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {b.image_urls.slice(1).map((url) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={url} src={url} alt="" className="h-40 w-full rounded-xl object-cover" />
            ))}
          </div>
        </div>
      )}

      {/* Community memories — fans' photos tagged to this broadcast, plus a CTA
          to add yours (deep-links the composer with this broadcast pre-tagged so
          the post lands right here in the capsule). */}
      <div className="mt-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="section-label">From the crowd</p>
            <p className="text-xs text-stone-500">Tagged here</p>
          </div>
          <Link
            href={`/share?event=${b.id}&eventTitle=${encodeURIComponent(b.whats_on || eventLabel(b.event_slug, b.event_label))}`}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-rose-600 px-3.5 py-2 text-[13px] font-semibold text-white transition hover:bg-rose-700"
          >
            <Camera className="h-4 w-4" /> Post your vibe
          </Link>
        </div>
        <MemoriesGrid eventId={b.id} title={null} />
      </div>

      {/* Map */}
      {typeof b.latitude === "number" && typeof b.longitude === "number" && (
        <div className="mt-6">
          <p className="section-label mb-2">Where</p>
          <LiveMap broadcasts={[b]} />
        </div>
      )}

      {/* Was `/live?event=<slug>` — and /live redirects to "/", which is the
          Products tab now, so it dropped the reader on a shop grid. The match
          page is what this link actually meant. */}
      <div className="mt-10 border-t border-stone-100 pt-5">
        <Link
          href={matchHref}
          className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-coral-600 transition hover:text-coral-700"
        >
          Everywhere else showing {b.whats_on || eventLabel(b.event_slug, b.event_label)} →
        </Link>
      </div>
    </div>
  );
}
