"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, CalendarDays } from "lucide-react";
import type { VendorEvent } from "@/lib/vendor-connect";
import { EventThread } from "@/components/organize/EventThread";
import { EventAttendees } from "@/components/organize/EventAttendees";
import { EventPreview } from "@/components/organize/EventPreview";

type Tab = "updates" | "attendees" | "preview";

// Per-event manager for a normal vendor event — like /vendor/organize but
// scoped to one event and without the festival Lineup tab.
export function EventManager({
  event,
  memberId,
  isAdmin,
  emailReady,
}: {
  event: VendorEvent;
  memberId: string;
  isAdmin: boolean;
  emailReady: boolean;
}) {
  const [tab, setTab] = useState<Tab>("updates");

  return (
    <div className="space-y-6">
      <Link href="/vendor/events" className="inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-800">
        <ArrowLeft className="h-4 w-4" /> Back to events
      </Link>

      <div className="flex items-start gap-3">
        <CalendarDays className="mt-0.5 h-6 w-6 text-indigo-500" />
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">{event.title}</h1>
          <p className="mt-1 text-sm text-stone-500">
            {[event.event_date, event.event_time, event.location].filter(Boolean).join(" · ") || "No date set"}
            {!event.active && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">draft</span>}
          </p>
        </div>
      </div>

      <div className="flex gap-1 border-b border-stone-200">
        {([
          ["updates", "Updates"],
          ["attendees", "Attendees"],
          ["preview", "Event page"],
        ] as [Tab, string][]).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
              tab === k
                ? "border-indigo-500 text-indigo-700"
                : "border-transparent text-stone-500 hover:text-stone-800"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "attendees" ? (
        <EventAttendees event={event} emailReady={emailReady} />
      ) : tab === "preview" ? (
        <EventPreview event={event} isAdmin={isAdmin} memberId={memberId} />
      ) : (
        <EventThread event={event} memberId={memberId} isAdmin={isAdmin} emailReady={emailReady} audienceLabel="squad" showSquad />
      )}
    </div>
  );
}
