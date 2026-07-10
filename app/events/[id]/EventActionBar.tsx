"use client";

import { useState } from "react";
import { Ticket, Check, Bell } from "lucide-react";
import { ShareMenu } from "@/components/ShareMenu";

export function EventActionBar({ title }: { title: string }) {
  const [rsvped, setRsvped] = useState(false);
  const [reminded, setReminded] = useState(false);

  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => setRsvped((v) => !v)}
        className={
          "inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition " +
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
          "inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition " +
          (reminded
            ? "border-indigo-200 bg-indigo-50 text-indigo-700"
            : "border-stone-200 bg-white text-stone-700 hover:border-stone-300")
        }
      >
        <Bell className="size-4" />
        {reminded ? "Reminder set" : "Remind me"}
      </button>

      <ShareMenu title={title} />
    </div>
  );
}
