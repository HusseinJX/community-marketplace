"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Ticket as TicketIcon, Plus, Trash2, ScanLine, AlertTriangle } from "lucide-react";
import type { VendorEvent } from "@/lib/vendor-connect";

interface TypeRow {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  quantity: number | null;
  max_per_order: number;
  active: boolean;
  sold: number;
  remaining: number | null;
  soldOut: boolean;
}

const DEMO_TYPES: TypeRow[] = [
  { id: "d1", name: "General admission", description: null, price_cents: 1500, quantity: 120, max_per_order: 6, active: true, sold: 43, remaining: 77, soldOut: false },
  { id: "d2", name: "Supporter", description: "Includes a drink", price_cents: 3500, quantity: 30, max_per_order: 4, active: true, sold: 11, remaining: 19, soldOut: false },
];

/**
 * Ticket tiers for one event, plus the door link.
 *
 * An event with no tiers keeps the plain free RSVP it has always had — tiers
 * are an upgrade, not a prerequisite. That's why the empty state explains what
 * adding one changes rather than demanding you add one.
 */
export function EventTickets({ event, demo = false }: { event: VendorEvent; demo?: boolean }) {
  // Demo fixtures seed the initial state rather than being set from an effect —
  // they're known at first render, so there's nothing to synchronize.
  const [types, setTypes] = useState<TypeRow[]>(() => (demo ? DEMO_TYPES : []));
  const [payoutsReady, setPayoutsReady] = useState(true);
  const [loading, setLoading] = useState(!demo);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("General admission");
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (demo) return;
    fetch(`/api/vendor/events/${event.id}/ticket-types`)
      .then((r) => (r.ok ? r.json() : { types: [] }))
      .then((d) => {
        setTypes(Array.isArray(d.types) ? d.types : []);
        setPayoutsReady(d.payoutsReady !== false);
        setLoading(false);
      })
      .catch(() => {
        setTypes([]);
        setLoading(false);
      });
  }, [event.id, demo]);

  useEffect(load, [load]);

  async function add() {
    setError(null);
    const cents = Math.round(parseFloat(price || "0") * 100);
    if (!name.trim()) return setError("Give the tier a name.");
    if (Number.isNaN(cents) || cents < 0) return setError("Enter a price, or 0 for free.");

    setBusy(true);
    try {
      const res = await fetch(`/api/vendor/events/${event.id}/ticket-types`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          priceCents: cents,
          quantity: quantity.trim() === "" ? null : Number(quantity),
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "Couldn't add that tier.");
      } else {
        setAdding(false);
        setName("General admission");
        setPrice("");
        setQuantity("");
        load();
      }
    } finally {
      setBusy(false);
    }
  }

  async function remove(t: TypeRow) {
    // Sold tiers deactivate server-side rather than vanish — say so, because
    // "delete" that leaves a row behind looks broken otherwise.
    const message = t.sold > 0
      ? `${t.sold} ${t.sold === 1 ? "ticket has" : "tickets have"} been issued for "${t.name}". It will stop selling, but those tickets stay valid. Continue?`
      : `Remove "${t.name}"?`;
    if (!confirm(message)) return;
    await fetch(`/api/vendor/events/${event.id}/ticket-types?id=${t.id}`, { method: "DELETE" });
    load();
  }

  const totalSold = types.reduce((n, t) => n + t.sold, 0);
  const hasPaid = types.some((t) => t.price_cents > 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-stone-500">
          {totalSold > 0 ? `${totalSold} issued` : "No tickets issued yet"}
        </p>
        <Link
          href={`/vendor/checkin/${event.id}`}
          className="inline-flex items-center gap-1.5 rounded-xl bg-stone-900 px-3 py-2 text-sm font-semibold text-white hover:bg-stone-800"
        >
          <ScanLine className="h-4 w-4" /> Check in at the door
        </Link>
      </div>

      {hasPaid && !payoutsReady && (
        <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Paid tickets won&apos;t sell until your payouts are set up.{" "}
            <Link href="/vendor/integrations" className="font-semibold underline">
              Finish setup
            </Link>
          </span>
        </p>
      )}

      {loading ? (
        <p className="text-sm text-stone-400">Loading…</p>
      ) : types.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-300 p-5 text-center">
          <TicketIcon className="mx-auto h-7 w-7 text-stone-300" />
          <p className="mt-2 text-sm text-stone-600">
            Right now people can RSVP for free — and every RSVP already gets a QR you can scan at the door.
          </p>
          <p className="mt-1 text-sm text-stone-500">Add a tier to sell tickets or cap how many go out.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {types.map((t) => (
            <li
              key={t.id}
              className={
                "flex items-center gap-3 rounded-xl border px-3.5 py-3 " +
                (t.active ? "border-stone-200 bg-white" : "border-stone-100 bg-stone-50 opacity-60")
              }
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-stone-900">
                  {t.name}
                  {!t.active && <span className="ml-2 text-xs font-normal text-stone-500">· closed</span>}
                </p>
                <p className="mt-0.5 text-xs text-stone-500">
                  <span className="font-semibold text-stone-700">
                    {t.price_cents === 0 ? "Free" : `$${(t.price_cents / 100).toFixed(2)}`}
                  </span>
                  {" · "}
                  {t.sold} sold
                  {t.quantity != null && ` of ${t.quantity}`}
                  {t.soldOut && <span className="ml-1 text-rose-600">· sold out</span>}
                </p>
              </div>
              <button
                onClick={() => remove(t)}
                aria-label={`Remove ${t.name}`}
                className="shrink-0 rounded-lg p-2 text-stone-400 hover:bg-stone-100 hover:text-rose-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {adding ? (
        <div className="rounded-2xl border border-stone-200 bg-white p-4">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Tier name"
            className="w-full rounded-xl border border-stone-200 px-3 py-2.5 text-sm"
          />
          <div className="mt-2 flex gap-2">
            <div className="flex-1">
              <label className="text-xs text-stone-500" htmlFor="tier-price">
                Price ($)
              </label>
              <input
                id="tier-price"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                inputMode="decimal"
                placeholder="0 for free"
                className="mt-0.5 w-full rounded-xl border border-stone-200 px-3 py-2.5 text-sm"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs text-stone-500" htmlFor="tier-qty">
                How many
              </label>
              <input
                id="tier-qty"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                inputMode="numeric"
                placeholder="Unlimited"
                className="mt-0.5 w-full rounded-xl border border-stone-200 px-3 py-2.5 text-sm"
              />
            </div>
          </div>
          {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
          <div className="mt-3 flex gap-2">
            <button
              onClick={add}
              disabled={busy}
              className="flex-1 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {busy ? "Adding…" : "Add tier"}
            </button>
            <button
              onClick={() => setAdding(false)}
              className="rounded-xl px-4 py-2.5 text-sm font-medium text-stone-500 hover:text-stone-800"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 px-3.5 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
        >
          <Plus className="h-4 w-4" /> Add a ticket tier
        </button>
      )}
    </div>
  );
}
