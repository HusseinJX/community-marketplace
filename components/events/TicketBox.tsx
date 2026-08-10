"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Ticket as TicketIcon, Minus, Plus, ArrowRight } from "lucide-react";
import { useUser } from "@clerk/nextjs";
import { RsvpButton } from "./RsvpButton";

interface PublicTicketType {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  currency: string;
  remaining: number | null;
  soldOut: boolean;
  closed: boolean;
  maxPerOrder: number;
}

function money(cents: number) {
  return cents === 0 ? "Free" : `$${(cents / 100).toFixed(2)}`;
}

/**
 * The event page's "get in" control.
 *
 * Two shapes, one component, because the visitor shouldn't have to know which
 * kind of event they're looking at: an organizer who defined ticket tiers gets
 * the tier picker; one who didn't gets the plain RSVP button that has always
 * been here. Loading state renders the RSVP button rather than a spinner —
 * that's the common case and a flash of nothing on the primary CTA is worse
 * than a control that occasionally upgrades itself.
 */
export function TicketBox({ eventId, demo }: { eventId: string; demo?: boolean }) {
  const { user } = useUser();
  const [types, setTypes] = useState<PublicTicketType[] | null>(null);
  const [payable, setPayable] = useState(true);
  const [qty, setQty] = useState<Record<string, number>>({});

  useEffect(() => {
    fetch(`/api/tickets/event/${eventId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return setTypes([]);
        setTypes(Array.isArray(d.types) ? d.types : []);
        setPayable(d.payable !== false);
      })
      .catch(() => setTypes([]));
  }, [eventId]);

  if (types === null || types.length === 0) {
    return <RsvpButton eventId={eventId} demo={demo} />;
  }

  const total = types.reduce((sum, t) => sum + t.priceCents * (qty[t.id] ?? 0), 0);
  const count = types.reduce((n, t) => n + (qty[t.id] ?? 0), 0);
  const allGone = types.every((t) => t.soldOut || t.closed);

  function bump(t: PublicTicketType, delta: number) {
    setQty((q) => {
      const ceiling = Math.min(t.maxPerOrder, t.remaining ?? t.maxPerOrder);
      const next = Math.max(0, Math.min(ceiling, (q[t.id] ?? 0) + delta));
      return { ...q, [t.id]: next };
    });
  }

  const href = `/events/${eventId}/tickets?${new URLSearchParams(
    Object.entries(qty)
      .filter(([, n]) => n > 0)
      .map(([id, n]) => [id, String(n)])
  )}`;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-stone-900">
        <TicketIcon className="h-4 w-4 text-indigo-600" /> Tickets
      </p>

      <ul className="mt-3 space-y-2">
        {types.map((t) => {
          const n = qty[t.id] ?? 0;
          const unavailable = t.soldOut || t.closed;
          return (
            <li
              key={t.id}
              className={
                "flex items-center gap-3 rounded-xl border px-3 py-2.5 " +
                (unavailable ? "border-stone-100 bg-stone-50 opacity-60" : "border-stone-200")
              }
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-stone-900">{t.name}</p>
                {t.description && <p className="truncate text-xs text-stone-500">{t.description}</p>}
                <p className="mt-0.5 text-xs">
                  <span className="font-semibold text-stone-800">{money(t.priceCents)}</span>
                  {t.closed ? (
                    <span className="ml-1.5 text-stone-500">· Sales ended</span>
                  ) : t.soldOut ? (
                    <span className="ml-1.5 text-rose-600">· Sold out</span>
                  ) : t.remaining != null && t.remaining <= 10 ? (
                    <span className="ml-1.5 text-amber-600">· {t.remaining} left</span>
                  ) : null}
                </p>
              </div>

              {!unavailable && (
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => bump(t, -1)}
                    disabled={n === 0}
                    aria-label={`One fewer ${t.name}`}
                    className="grid h-8 w-8 place-items-center rounded-lg border border-stone-200 text-stone-600 disabled:opacity-40"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="w-6 text-center text-sm font-semibold tabular-nums">{n}</span>
                  <button
                    type="button"
                    onClick={() => bump(t, 1)}
                    aria-label={`One more ${t.name}`}
                    className="grid h-8 w-8 place-items-center rounded-lg border border-stone-200 text-stone-600"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {allGone ? (
        <p className="mt-3 rounded-xl bg-stone-100 px-3 py-2.5 text-center text-sm font-medium text-stone-600">
          No tickets available
        </p>
      ) : !payable ? (
        // Said plainly and early: the organizer can define a price before they
        // can be paid, and letting someone reach a dead payment form is worse.
        <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2.5 text-center text-sm text-amber-800">
          Ticket sales aren&apos;t open yet — the organizer is still setting up payments.
        </p>
      ) : (
        <>
          <Link
            href={count > 0 ? href : "#"}
            aria-disabled={count === 0}
            onClick={(e) => count === 0 && e.preventDefault()}
            className={
              "mt-3 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition " +
              (count === 0
                ? "pointer-events-none bg-stone-200 text-stone-500"
                : "bg-indigo-600 text-white hover:bg-indigo-700")
            }
          >
            {count === 0 ? "Select tickets" : total === 0 ? `Get ${count} ${count === 1 ? "ticket" : "tickets"}` : `Checkout · $${(total / 100).toFixed(2)}`}
            {count > 0 && <ArrowRight className="h-4 w-4" />}
          </Link>
          <p className="mt-2 text-center text-xs text-stone-500">
            {user ? "Sent to your email and saved to your account." : "No account needed — tickets are emailed to you."}
          </p>
        </>
      )}
    </div>
  );
}
