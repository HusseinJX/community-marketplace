"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarClock, Check, X, Mail, Phone } from "lucide-react";
import type { BookingRequest } from "@/lib/bookings";

const STATUS_STYLE: Record<string, string> = {
  requested: "bg-amber-50 text-amber-700",
  confirmed: "bg-emerald-50 text-emerald-700",
  declined: "bg-stone-100 text-stone-500",
  cancelled: "bg-stone-100 text-stone-500",
  completed: "bg-emerald-50 text-emerald-700",
};

/**
 * Answer booking requests.
 *
 * Open requests come first regardless of date — an unanswered request is the
 * only thing here that needs the owner to act, and burying it under next
 * month's confirmed bookings is how people get ignored.
 */
export function BookingsManager() {
  const [bookings, setBookings] = useState<BookingRequest[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  // Answering "not then, but Friday works" is the commonest real reply, so the
  // confirm control can name a different time rather than forcing a decline.
  const [editing, setEditing] = useState<string | null>(null);
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");
  const [note, setNote] = useState("");

  const load = useCallback(() => {
    fetch("/api/vendor/bookings")
      .then((r) => (r.ok ? r.json() : { bookings: [] }))
      .then((d) => setBookings(Array.isArray(d.bookings) ? d.bookings : []))
      .catch(() => setBookings([]));
  }, []);

  useEffect(load, [load]);

  async function answer(b: BookingRequest, status: string, override = false) {
    setBusy(b.id);
    try {
      await fetch("/api/vendor/bookings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: b.id,
          status,
          confirmedDate: override && newDate ? newDate : undefined,
          confirmedTime: override && newTime ? newTime : undefined,
          vendorNote: note.trim() || undefined,
        }),
      });
      setEditing(null);
      setNewDate("");
      setNewTime("");
      setNote("");
      load();
    } finally {
      setBusy(null);
    }
  }

  if (bookings === null) return <p className="mt-6 text-sm text-stone-400">Loading…</p>;

  if (bookings.length === 0) {
    return (
      <div className="mt-6 rounded-2xl border border-dashed border-stone-300 p-6 text-center">
        <CalendarClock className="mx-auto h-7 w-7 text-stone-300" />
        <p className="mt-2 text-sm text-stone-600">No booking requests yet.</p>
        <p className="mt-1 text-sm text-stone-500">
          They arrive from the Book button on your profile.
        </p>
      </div>
    );
  }

  return (
    <ul className="mt-5 space-y-2">
      {bookings.map((b) => {
        const open = b.status === "requested";
        const when = [b.confirmed_date ?? b.requested_date, b.confirmed_time ?? b.requested_time]
          .filter(Boolean)
          .join(" · ");
        return (
          <li key={b.id} className="rounded-2xl border border-stone-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-stone-900">
                  {b.customer_name || b.customer_email || "Someone"}
                </p>
                <p className="mt-0.5 text-sm text-stone-700">{when || "Time to be agreed"}</p>
                {b.alt_date && b.status === "requested" && (
                  <p className="mt-0.5 text-xs text-stone-500">or {b.alt_date}</p>
                )}
                {b.service_name && <p className="mt-0.5 text-xs text-stone-500">{b.service_name}</p>}
                {b.note && (
                  // Marked private: PostHog replay records everything a customer
                  // writes unless the surface is masked.
                  <p data-private className="mt-1.5 rounded-lg bg-stone-50 px-2.5 py-1.5 text-xs text-stone-600">
                    {b.note}
                  </p>
                )}
                <p className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-stone-500">
                  {b.customer_email && (
                    <a href={`mailto:${b.customer_email}`} className="inline-flex items-center gap-1 hover:text-stone-800">
                      <Mail className="h-3 w-3" /> {b.customer_email}
                    </a>
                  )}
                  {b.customer_phone && (
                    <a href={`tel:${b.customer_phone}`} className="inline-flex items-center gap-1 hover:text-stone-800">
                      <Phone className="h-3 w-3" /> {b.customer_phone}
                    </a>
                  )}
                </p>
              </div>
              <span
                className={
                  "shrink-0 rounded-full px-2.5 py-1 text-xs font-medium " +
                  (STATUS_STYLE[b.status] ?? "bg-stone-100 text-stone-500")
                }
              >
                {b.status === "requested" ? "Needs a reply" : b.status}
              </span>
            </div>

            {open && (
              <div className="mt-3 space-y-2">
                {editing === b.id && (
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="date"
                      value={newDate}
                      onChange={(e) => setNewDate(e.target.value)}
                      className="rounded-lg border border-stone-200 px-3 py-2 text-sm"
                    />
                    <input
                      value={newTime}
                      onChange={(e) => setNewTime(e.target.value)}
                      placeholder="Time"
                      className="rounded-lg border border-stone-200 px-3 py-2 text-sm"
                    />
                    <input
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Add a note (optional)"
                      className="col-span-2 rounded-lg border border-stone-200 px-3 py-2 text-sm"
                    />
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => answer(b, "confirmed", editing === b.id)}
                    disabled={busy === b.id}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    <Check className="h-3.5 w-3.5" />
                    {editing === b.id ? "Confirm this time" : "Confirm"}
                  </button>
                  {editing !== b.id && (
                    <button
                      onClick={() => {
                        setEditing(b.id);
                        setNewDate(b.requested_date ?? "");
                        setNewTime(b.requested_time ?? "");
                      }}
                      className="rounded-lg border border-stone-200 px-3 py-1.5 text-[13px] font-medium text-stone-700 hover:border-stone-300"
                    >
                      Suggest another time
                    </button>
                  )}
                  <button
                    onClick={() => answer(b, "declined")}
                    disabled={busy === b.id}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 px-3 py-1.5 text-[13px] font-medium text-stone-600 hover:border-rose-300 hover:text-rose-600 disabled:opacity-50"
                  >
                    <X className="h-3.5 w-3.5" /> Can&apos;t make it
                  </button>
                </div>
              </div>
            )}

            {b.status === "confirmed" && (
              <button
                onClick={() => answer(b, "completed")}
                disabled={busy === b.id}
                className="mt-3 rounded-lg border border-stone-200 px-3 py-1.5 text-[13px] font-medium text-stone-700 hover:border-stone-300 disabled:opacity-50"
              >
                Mark done
              </button>
            )}
            {b.vendor_note && !open && (
              <p className="mt-2 text-xs text-stone-500">You said: {b.vendor_note}</p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
