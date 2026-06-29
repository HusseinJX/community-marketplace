"use client";

import { useEffect, useState } from "react";
import { CalendarCheck, Check } from "lucide-react";
import { useAuth, SignInButton } from "@clerk/nextjs";

// Free RSVP for an organizer event. Shows the live going count + spots left and
// toggles the current user's attendance. Signed-out users get a sign-in modal.
export function RsvpButton({ eventId, demo }: { eventId: string; demo?: boolean }) {
  const { isSignedIn, isLoaded } = useAuth();
  const [count, setCount] = useState(0);
  const [capacity, setCapacity] = useState<number | null>(null);
  const [going, setGoing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [full, setFull] = useState(false);
  const [phone, setPhone] = useState("");
  const [remindSaved, setRemindSaved] = useState(false);

  async function saveReminder(e: React.FormEvent) {
    e.preventDefault();
    if (!phone.trim()) return;
    try {
      await fetch(`/api/rsvp/${eventId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim() }),
      });
      setRemindSaved(true);
    } catch {
      /* leave state */
    }
  }

  useEffect(() => {
    fetch(`/api/rsvp/${eventId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setCount(d.count ?? 0);
        setCapacity(d.capacity ?? null);
        setGoing(!!d.going);
      })
      .catch(() => {});
  }, [eventId]);

  const spotsLeft = capacity != null ? Math.max(0, capacity - count) : null;
  const canRsvp = isSignedIn || demo;

  async function toggle() {
    if (busy) return;
    setBusy(true);
    setFull(false);
    const next = !going;
    try {
      const res = await fetch(`/api/rsvp/${eventId}`, { method: next ? "POST" : "DELETE", headers: { "Content-Type": "application/json" }, body: "{}" });
      const d = await res.json().catch(() => ({}));
      if (res.status === 409) {
        setFull(true);
        return;
      }
      if (!res.ok) throw new Error(d.error || "failed");
      setGoing(next);
      if (typeof d.count === "number") setCount(d.count);
    } catch {
      /* leave state */
    } finally {
      setBusy(false);
    }
  }

  const meta = (
    <p className="mt-2 text-sm text-stone-500">
      <span className="font-semibold text-stone-800">{count}</span> going
      {capacity != null &&
        (spotsLeft === 0 ? (
          <span className="ml-1 text-rose-600">· Full</span>
        ) : (
          <span className="ml-1">· {spotsLeft} spots left</span>
        ))}
    </p>
  );

  if (isLoaded && !canRsvp) {
    return (
      <div>
        <SignInButton mode="modal">
          <button className="w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700">
            RSVP — sign in
          </button>
        </SignInButton>
        {meta}
      </div>
    );
  }

  const soldOut = capacity != null && spotsLeft === 0 && !going;

  return (
    <div>
      <button
        onClick={toggle}
        disabled={busy || soldOut}
        className={
          "inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:opacity-60 " +
          (going
            ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
            : soldOut
              ? "bg-stone-200 text-stone-500"
              : "bg-indigo-600 text-white hover:bg-indigo-700")
        }
      >
        {going ? (
          <>
            <Check className="h-4 w-4" /> You&apos;re going · Cancel
          </>
        ) : soldOut ? (
          "Event full"
        ) : (
          <>
            <CalendarCheck className="h-4 w-4" /> RSVP
          </>
        )}
      </button>
      {meta}
      {full && <p className="mt-1 text-xs text-rose-600">Sorry — this event just filled up.</p>}

      {going &&
        (remindSaved ? (
          <p className="mt-2 text-xs text-emerald-600">📱 We&apos;ll text you a reminder before it starts.</p>
        ) : (
          <form onSubmit={saveReminder} className="mt-2 flex items-center gap-2">
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Phone for a text reminder"
              inputMode="tel"
              className="min-w-0 flex-1 rounded-lg border border-stone-200 px-2 py-1.5 text-xs"
            />
            <button
              type="submit"
              disabled={!phone.trim()}
              className="shrink-0 rounded-lg bg-stone-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-stone-800 disabled:opacity-50"
            >
              Remind me
            </button>
          </form>
        ))}
    </div>
  );
}
