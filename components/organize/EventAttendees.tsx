"use client";

import { useEffect, useState } from "react";
import { Users, Megaphone, Send } from "lucide-react";
import type { VendorEvent } from "@/lib/vendor-connect";
import type { Attendee } from "@/lib/attendees";

// RSVP list + a blast composer (custom message via SMS / email) to attendees.
// Shared by the festival organizer (/vendor/organize) and the per-event manager.
export function EventAttendees({ event, emailReady }: { event: VendorEvent; emailReady: boolean }) {
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [count, setCount] = useState(0);
  const [capacity, setCapacity] = useState<number | null>(null);
  const [blastText, setBlastText] = useState("");
  const [sms, setSms] = useState(true);
  const [email, setEmail] = useState(false);
  const [blasting, setBlasting] = useState(false);
  const [blastMsg, setBlastMsg] = useState("");

  useEffect(() => {
    fetch(`/api/vendor/events/${event.id}/attendees`)
      .then((r) => (r.ok ? r.json() : { attendees: [] }))
      .then((d) => {
        setAttendees(Array.isArray(d.attendees) ? d.attendees : []);
        setCount(d.count ?? 0);
        setCapacity(d.capacity ?? null);
      })
      .catch(() => {});
  }, [event.id]);

  const phoneCount = attendees.filter((a) => (a.attendee_contact || "").replace(/\D/g, "").length >= 10).length;
  const emailCount = attendees.filter((a) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test((a.attendee_contact || "").trim())).length;

  async function blast() {
    const channels = [...(sms ? ["sms"] : []), ...(email ? ["email"] : [])];
    if (channels.length === 0) {
      setBlastMsg("Pick SMS or email.");
      return;
    }
    setBlasting(true);
    setBlastMsg("");
    try {
      const res = await fetch(`/api/vendor/events/${event.id}/attendees/remind`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: blastText.trim() || undefined, channels }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        const parts = [];
        if (channels.includes("sms")) parts.push(`texted ${d.sent ?? 0}/${d.withPhone ?? 0}`);
        if (channels.includes("email")) parts.push(`emailed ${d.emailed ?? 0}/${d.withEmail ?? 0}`);
        setBlastMsg(`Sent — ${parts.join(" · ")}.`);
        setBlastText("");
      } else {
        setBlastMsg(d.error || "Failed");
      }
    } catch {
      setBlastMsg("Failed");
    } finally {
      setBlasting(false);
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Users className="h-5 w-5 text-indigo-500" />
        <p className="text-sm text-stone-700">
          <span className="font-semibold text-stone-900">{count}</span> going
          {capacity != null && <span className="text-stone-400"> · cap {capacity}</span>}
        </p>
      </div>

      {/* Blast attendees — custom message via SMS / email */}
      {attendees.length > 0 && (
        <div className="card-soft mb-4 p-3">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-stone-500">
            <Megaphone className="h-3.5 w-3.5 text-indigo-500" /> Blast your attendees
          </div>
          <textarea
            value={blastText}
            onChange={(e) => setBlastText(e.target.value)}
            placeholder="Message to attendees… (leave blank for a default reminder)"
            rows={2}
            className="w-full resize-none rounded-lg border border-stone-200 p-2 text-sm"
          />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-3 text-xs">
              <label className="flex items-center gap-1 text-stone-600">
                <input type="checkbox" checked={sms} onChange={(e) => setSms(e.target.checked)} className="accent-indigo-600" />
                SMS ({phoneCount})
              </label>
              <label
                className={`flex items-center gap-1 ${emailReady ? "text-stone-600" : "text-stone-300"}`}
                title={emailReady ? "" : "Set RESEND_API_KEY + RESEND_FROM to enable email"}
              >
                <input
                  type="checkbox"
                  checked={email}
                  disabled={!emailReady}
                  onChange={(e) => setEmail(e.target.checked)}
                  className="accent-indigo-600"
                />
                Email ({emailCount})
              </label>
            </div>
            <button
              onClick={blast}
              disabled={blasting || (!sms && !email)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-stone-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-50"
            >
              <Send className="h-3.5 w-3.5" /> {blasting ? "Sending…" : "Send blast"}
            </button>
          </div>
          {blastMsg && <p className="mt-2 text-xs text-stone-500">{blastMsg}</p>}
        </div>
      )}

      {attendees.length === 0 ? (
        <p className="text-sm text-stone-400">No RSVPs yet. Share the event link to fill it up.</p>
      ) : (
        <ul className="divide-y divide-stone-100 rounded-lg border border-stone-100">
          {attendees.map((a) => (
            <li key={a.id} className="flex items-center justify-between px-3 py-2 text-sm">
              <span className="text-stone-800">{a.attendee_name || "Guest"}</span>
              <span className="text-xs text-stone-400">
                {a.party_size > 1 ? `+${a.party_size - 1} guest${a.party_size > 2 ? "s" : ""}` : "1"}
                {a.attendee_contact ? ` · ${a.attendee_contact}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
