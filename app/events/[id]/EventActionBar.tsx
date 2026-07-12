"use client";

import { useState } from "react";
import Link from "next/link";
import { Ticket, Check, Bell, Tag } from "lucide-react";
import { ShareMenu } from "@/components/ShareMenu";

export function EventActionBar({ title, eventId }: { title: string; eventId: string }) {
  const [rsvped, setRsvped] = useState(false);
  const [reminded, setReminded] = useState(false);

  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => setRsvped((v) => !v)}
        className={
          "inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-medium transition " +
          (rsvped
            ? "bg-stone-900 text-white hover:bg-stone-800"
            : "bg-indigo-600 text-white hover:bg-indigo-700")
        }
      >
        {rsvped ? (
          <>
            <Check className="size-4" />
            You're going
          </>
        ) : (
          <>
            <Ticket className="size-4" />
            RSVP
          </>
        )}
      </button>

      <button
        onClick={() => setReminded((v) => !v)}
        className={
          "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13px] font-medium transition " +
          (reminded
            ? "border-indigo-200 bg-indigo-50 text-indigo-700"
            : "border-stone-200 bg-white text-stone-700 hover:border-stone-300")
        }
      >
        <Bell className="size-4" />
        {reminded ? "Reminder set" : "Remind me"}
      </button>

      <Link
        href={`/share?event=${eventId}&eventTitle=${encodeURIComponent(title)}`}
        className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3.5 py-2 text-[13px] font-medium text-stone-700 transition hover:border-indigo-300 hover:text-indigo-700"
      >
        <Tag className="size-4" />
        Tag
      </Link>

      <ShareMenu title={title} />
    </div>
  );
}
