import Link from "next/link";
import type { EventSuggestion } from "@/lib/types";

const EVENT_GRADIENTS = [
  "from-emerald-300 to-teal-500",
  "from-indigo-300 to-purple-500",
  "from-amber-300 to-orange-500",
  "from-pink-300 to-rose-500",
  "from-sky-300 to-blue-500",
  "from-lime-300 to-emerald-500",
];

function eventGradient(s: string) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return EVENT_GRADIENTS[h % EVENT_GRADIENTS.length];
}

export function EventCard({ event }: { event: EventSuggestion }) {
  const title = event.title || "Untitled event";
  const grad = eventGradient(title);
  return (
    <Link
      href={`/events/${event.id}`}
      className="card-soft card-hover group flex items-stretch gap-3 p-3"
    >
      <div className={`shrink-0 self-stretch w-20 rounded-lg bg-gradient-to-br ${grad}`} />
      <div className="min-w-0 flex-1 py-0.5">
        <div className="truncate font-medium text-stone-900 group-hover:text-indigo-700">{title}</div>
        {event.date && <div className="mt-1 text-sm text-stone-500">{event.date}</div>}
        {event.location && <div className="truncate text-sm text-stone-500">{event.location}</div>}
      </div>
    </Link>
  );
}
