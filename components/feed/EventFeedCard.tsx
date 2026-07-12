import Link from "next/link";
import { Calendar, MapPin } from "lucide-react";
import type { EventFeedItem } from "@/lib/demo-feed";
import { ImageCarousel } from "@/components/ImageCarousel";

export function EventFeedCard({ item }: { item: EventFeedItem }) {
  return (
    <article className="relative overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
      <div className="absolute inset-y-0 left-0 w-1 bg-emerald-400" />
      <div className="p-4 pl-6 sm:p-4 sm:pl-7">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-stone-500">
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
            <Calendar className="h-3 w-3" /> EVENT
          </span>
          <span>·</span>
          <span>Posted by</span>
          <Link href={`/members/${item.author.id}`} className="font-medium text-indigo-600 hover:underline">
            {item.author.name}
          </Link>
          <span>·</span>
          <span>{item.postedAt}</span>
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

        <div className="mt-4">
          <Link
            href={`/events/${item.eventId}`}
            className="text-sm font-medium text-indigo-600 hover:underline"
          >
            View details →
          </Link>
        </div>
      </div>
    </article>
  );
}
