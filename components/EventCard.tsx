import Link from "next/link";
import type { EventSuggestion } from "@/lib/types";

export function EventCard({ event }: { event: EventSuggestion }) {
  const title = event.title || "Untitled event";
  const description = event.reworded || event.description || event.originalExcerpt || "";
  const platform = event.source?.platform;

  return (
    <article className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-lg font-semibold text-stone-900">{title}</h3>
        {platform && (
          <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 ring-1 ring-inset ring-indigo-100">
            {platform}
          </span>
        )}
      </div>

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-stone-500">
        {event.date && <span>{event.date}</span>}
        {event.time && <span>{event.time}</span>}
        {event.location && <span>{event.location}</span>}
      </div>

      {description && (
        <p className="mt-3 text-sm text-stone-700">{description}</p>
      )}

      {event.memberId && event.memberName && (
        <div className="mt-4 border-t border-stone-100 pt-3 text-sm">
          <span className="text-stone-500">Posted by </span>
          <Link
            href={`/members/${event.memberId}`}
            className="font-medium text-indigo-700 hover:underline"
          >
            {event.memberName}
          </Link>
        </div>
      )}
    </article>
  );
}
