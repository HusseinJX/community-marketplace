"use client";

import { useEffect, useState } from "react";
import { Users, Megaphone, Send } from "lucide-react";
import type { VendorEvent } from "@/lib/vendor-connect";
import type { Attendee } from "@/lib/attendees";

// RSVP list + a blast composer (custom message via SMS / email) to attendees.
// Shared by the festival organizer (/vendor/organize) and the per-event manager.
export function EventAttendees({ event, emailReady, demo = false }: { event: VendorEvent; emailReady: boolean; demo?: boolean }) {
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [count, setCount] = useState(0);
  const [capacity, setCapacity] = useState<number | null>(null);
  const [blastText, setBlastText] = useState("");
  const [sms, setSms] = useState(true);
  const [email, setEmail] = useState(false);
  const [blasting, setBlasting] = useState(false);
  const [blastMsg, setBlastMsg] = useState("");

  useEffect(() => {
    if (demo) {
      const mk = (id: string, name: string, contact: string, party: number): Attendee => ({
        id, event_id: event.id, attendee_id: id, attendee_name: name, attendee_contact: contact, party_size: party, status: "going", created_at: "2026-06-24T15:00:00.000Z",
      });
      const list = [
        mk("demo-a-1", "Maya R.", "+14155550132", 2),
        mk("demo-a-2", "Devon P.", "devon@example.com", 1),
        mk("demo-a-3", "Priya S.", "+14155550188", 4),
        mk("demo-a-4", "Local Fan", "fan@example.com", 1),
      ];
      setAttendees(list);
      setCount(list.reduce((n, a) => n + a.party_size, 0));
      setCapacity(event.capacity);
      return;
    }
    fetch(`/api/vendor/events/${event.id}/attendees`)
      .then((r) => (r.ok ? r.json() : { attendees: [] }))
      .then((d) => {
        setAttendees(Array.isArray(d.attendees) ? d.attendees : []);
        setCount(d.count ?? 0);
        setCapacity(d.capacity ?? null);
      })
      .catch(() => {});
  }, [event.id, demo, event.capacity]);

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

  const pct = capacity ? Math.min(100, Math.round((count / capacity) * 100)) : 0;
  const left = capacity ? Math.max(0, capacity - count) : 0;

  return (
    <div className="space-y-4">
      {/* How full is it — the number an organizer actually opens this for. */}
      <div className="card-soft p-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="section-label mb-1">Going</p>
            <p className="text-2xl font-semibold leading-none text-stone-900">
              {count}
              {capacity != null && <span className="text-base font-normal text-stone-400"> / {capacity}</span>}
            </p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-stone-100 px-2.5 py-1 text-[11px] font-medium text-stone-600">
            <Users className="h-3.5 w-3.5" /> {attendees.length} {attendees.length === 1 ? "RSVP" : "RSVPs"}
          </span>
        </div>
        {capacity != null && (
          <>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-stone-100">
              <div
                className={`h-full rounded-full transition-all ${left === 0 ? "bg-rose-500" : "bg-indigo-500"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="mt-1.5 text-[11px] text-stone-400">
              {left === 0 ? "Full — no spots left." : `${left} spot${left === 1 ? "" : "s"} left`}
            </p>
          </>
        )}
      </div>

      {/* Blast attendees — custom message via SMS / email */}
      {attendees.length > 0 && (
        <div className="card-soft p-3">
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
        <p className="py-8 text-center text-sm text-stone-400">
          No RSVPs yet. Share the event link to fill it up.
        </p>
      ) : (
        <div>
          <p className="section-label mb-2">Attendees</p>
          <ul className="space-y-1.5">
            {attendees.map((a) => {
              const name = a.attendee_name || "Guest";
              const extra = a.party_size > 1 ? `+${a.party_size - 1} guest${a.party_size > 2 ? "s" : ""}` : null;
              return (
                <li
                  key={a.id}
                  className="flex items-center gap-3 rounded-xl border border-stone-200 bg-white px-3 py-2.5"
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-stone-100 text-[11px] font-semibold text-stone-500">
                    {name.slice(0, 2).toUpperCase()}
                  </span>
                  {/* min-w-0 + truncate: a long email used to squeeze the name out. */}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-stone-900">{name}</span>
                    {a.attendee_contact && (
                      <span className="mt-0.5 block truncate text-[11px] text-stone-500">{a.attendee_contact}</span>
                    )}
                  </span>
                  {extra && (
                    <span className="shrink-0 rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-600">
                      {extra}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
