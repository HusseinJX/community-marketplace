import Link from "next/link";
import { Calendar, MapPin } from "lucide-react";
import type { EventFeedItem } from "@/lib/demo-feed";
import { ImageCarousel } from "@/components/ImageCarousel";
import { SaveEventButton } from "@/components/events/SaveEventButton";

export function EventFeedCard({ item }: { item: EventFeedItem }) {
  // A harvested event's "author" is a public calendar, not a business with a
  // profile — so its byline is plain text. Linking it to /members/{id} would
  // point at a synthetic id ('source:sfpl') and 404.
  const scraped = !!item.sourceId;

  return (
    <article className="relative overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
      <div className="absolute inset-y-0 left-0 w-1 bg-emerald-400" />
      <div className="p-4 pl-6 sm:p-4 sm:pl-7">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-stone-500">
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
            <Calendar className="h-3 w-3" /> EVENT
          </span>
          <span>·</span>
          <span>{scraped ? "From" : "Posted by"}</span>
          {scraped ? (
            <span className="font-medium text-stone-700">{item.author.name}</span>
          ) : (
            <Link href={`/members/${item.author.id}`} className="font-medium text-indigo-600 hover:underline">
              {item.author.name}
            </Link>
          )}
          {!scraped && (
            <>
              <span>·</span>
              <span>{item.postedAt}</span>
            </>
          )}
        </div>

        <h3 className="mt-3 text-lg font-semibold leading-snug text-stone-900">{item.title}</h3>

        <div className="mt-3 space-y-1.5 text-sm text-stone-600">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-stone-400" />
            <span>{item.date}</span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-stone-400" />
            <span>{item.location}</span>
          </div>
        </div>

        <p className="mt-3 line-clamp-2 text-sm text-stone-600">{item.description}</p>

        {item.images && item.images.length > 0 && (
          <div className="mt-4">
            <ImageCarousel images={item.images} alt={item.title} aspect="video" rounded="rounded-xl" />
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1">
          <Link
            href={`/events/${item.eventId}`}
            className="text-sm font-medium text-indigo-600 hover:underline"
          >
            View details →
          </Link>
          <SaveEventButton eventId={item.eventId} variant="inline" className="-ml-2" />
          {scraped && item.eventUrl && (
            <a
              href={item.eventUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-stone-500 hover:text-stone-700 hover:underline"
            >
              Source
            </a>
          )}
        </div>
      </div>
    </article>
  );
}
