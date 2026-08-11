"use client";

import { useState } from "react";
import { CalendarClock, CheckCircle2 } from "lucide-react";
import { useUser } from "@clerk/nextjs";
import { sfToday } from "@/lib/sf-date";

/**
 * Ask a business for a time.
 *
 * Replaces the `BookFlow` prototype that used to open here — hardcoded venues,
 * no API calls, nothing stored, nobody notified.
 *
 * There is no slot grid because there is no availability to show: we don't have
 * the business's diary, and inventing slots would be a worse lie than asking.
 * The time is free text on purpose — "afternoon" and "after 5" are real answers
 * and a strict picker just makes people lie to the form.
 */
export function BookingRequest({
  memberId,
  memberName,
  serviceName,
  productId,
  onDone,
}: {
  memberId: string;
  memberName?: string;
  serviceName?: string;
  productId?: string;
  onDone?: () => void;
}) {
  const { user, isSignedIn } = useUser();
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [altDate, setAltDate] = useState("");
  const [showAlt, setShowAlt] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const accountEmail = user?.emailAddresses?.[0]?.emailAddress ?? "";
  const effectiveEmail = (email || accountEmail).trim();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!date) return setError("Pick a day that suits you.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(effectiveEmail)) {
      return setError("We need an email so they can get back to you.");
    }

    setBusy(true);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId,
          productId,
          serviceName,
          email: effectiveEmail,
          name: name.trim() || undefined,
          phone: phone.trim() || undefined,
          requestedDate: date,
          requestedTime: time.trim() || undefined,
          altDate: altDate || undefined,
          note: note.trim() || undefined,
        }),
      });
      const d = await res.json();
      if (!res.ok) setError(d.error ?? "Could not send that request.");
      else {
        setSent(true);
        onDone?.();
      }
    } catch {
      setError("Could not send that request.");
    }
    setBusy(false);
  }

  if (sent) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center">
        <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600" />
        <p className="mt-2 font-semibold text-stone-900">Request sent</p>
        <p className="mt-1 text-sm text-stone-600">
          {memberName || "They"} will confirm by email. Nothing is booked until they say yes.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <p className="flex items-center gap-2 text-sm text-stone-600">
        <CalendarClock className="h-4 w-4 text-stone-400" />
        Suggest a time and {memberName || "they"} will confirm.
      </p>

      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="text-xs text-stone-600">Day</span>
          <input
            type="date"
            value={date}
            min={sfToday()}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-xs text-stone-600">Time <span className="text-stone-400">(roughly)</span></span>
          <input
            value={time}
            onChange={(e) => setTime(e.target.value)}
            placeholder="Afternoon, after 5…"
            className="mt-1 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
          />
        </label>
      </div>

      {/* A second option costs one field and saves a whole round trip when the
          first doesn't work. */}
      {showAlt ? (
        <label className="block">
          <span className="text-xs text-stone-600">Another day that works</span>
          <input
            type="date"
            value={altDate}
            min={sfToday()}
            onChange={(e) => setAltDate(e.target.value)}
            className="mt-1 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
          />
        </label>
      ) : (
        <button
          type="button"
          onClick={() => setShowAlt(true)}
          className="text-xs font-medium text-indigo-600 hover:underline"
        >
          + Add a backup day
        </button>
      )}

      <div className="grid grid-cols-2 gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={user?.firstName ?? "Your name"}
          className="rounded-lg border border-stone-200 px-3 py-2 text-sm"
        />
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Phone (optional)"
          inputMode="tel"
          className="rounded-lg border border-stone-200 px-3 py-2 text-sm"
        />
      </div>

      <input
        type="email"
        inputMode="email"
        autoComplete="email"
        value={email || accountEmail}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
      />

      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        placeholder="Anything they should know?"
        className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
      />

      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
      >
        {busy ? "Sending…" : "Request this time"}
      </button>
      <p className="text-center text-xs text-stone-500">
        {isSignedIn
          ? "Nothing is booked until they confirm."
          : "No account needed — nothing is booked until they confirm."}
      </p>
    </form>
  );
}
