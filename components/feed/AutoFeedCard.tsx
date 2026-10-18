import Link from "next/link";
import { ArrowUpRight, MapPin } from "lucide-react";
import type { AutoFeedItem } from "@/lib/demo-feed";
import { milesLabel } from "@/lib/proximity";

// Seeded WhatsLocal content — an event recap.
//
// The poster IS the post: a big image and one line under it, because the
// picture is the interesting part and a thumbnail beside a sentence read like
// a log entry. What keeps it honest is the byline, not the size — it is
// always WhatsLocal with a "Recap" label, never dressed as a person's post
// (features/community-feed-seeding.md, "Visual separation").
export function AutoFeedCard({ item }: { item: AutoFeedItem }) {
  const when = item.eventDate
    ? new Date(`${item.eventDate}T12:00:00Z`).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      })
    : null;
  const where = item.venue || item.neighborhood;

  return (
    <article className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
      <div className="flex items-center gap-2 px-4 py-3 text-xs text-stone-500">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="" className="h-6 w-6 shrink-0" />
        <span className="text-sm font-semibold text-stone-900">WhatsLocal</span>
        <span className="rounded-full bg-stone-100 px-2 py-0.5 font-medium text-stone-600">
          {item.layer === "event" ? "Recap" : "From WhatsLocal"}
        </span>
      </div>

      {item.image && (
        // Lazy and height-capped: eager full-width posters are what ran the
        // iOS WKWebView out of memory (PersonalizedEvents.tsx, PAGE).
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.image}
          alt={item.title ?? ""}
          loading="lazy"
          className="max-h-[520px] w-full bg-stone-100 object-cover"
        />
      )}

      <div className="px-4 py-3">
        <p className="text-[15px] leading-snug text-stone-900">{item.body}</p>

        {(when || where) && (
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-500">
            {when && <span>{when}</span>}
            {where && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {where}
                {item.miles != null && <span className="text-stone-400">· {milesLabel(item.miles)}</span>}
              </span>
            )}
          </div>
        )}

        {item.eventId ? (
          // Our page first — the event stays in the table for 30 days after it
          // ends (lib/sources/persist.ts pruneFinished). Own line, left-aligned,
          // so it sits in the same place on every card.
          <Link
            href={`/events/${item.eventId}`}
            className="mt-3 inline-flex items-center rounded-full border border-stone-200 bg-white px-3 py-1 text-xs font-medium text-stone-800 transition hover:border-stone-300 hover:bg-stone-50"
          >
            Event page
          </Link>
        ) : (
          item.linkUrl && (
            <a
              href={item.linkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-0.5 rounded-full border border-stone-200 bg-white px-3 py-1 text-xs font-medium text-stone-800 transition hover:border-stone-300 hover:bg-stone-50"
            >
              {item.linkLabel || "More"}
              <ArrowUpRight className="h-3 w-3" />
            </a>
          )
        )}
      </div>
    </article>
  );
}
