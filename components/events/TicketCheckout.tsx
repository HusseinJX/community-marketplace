"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { useUser } from "@clerk/nextjs";
import { CheckCircle2, Minus, Plus, Ticket as TicketIcon } from "lucide-react";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

export interface PublicTicketType {
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

interface IssuedTicket {
  token: string;
  code: string;
  typeName: string | null;
}

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export function TicketCheckout({
  eventId,
  eventTitle,
  types,
  initialSelection,
}: {
  eventId: string;
  eventTitle: string;
  types: PublicTicketType[];
  initialSelection: { id: string; quantity: number }[];
}) {
  const { user, isSignedIn } = useUser();
  const [qty, setQty] = useState<Record<string, number>>(() =>
    Object.fromEntries(initialSelection.map((s) => [s.id, s.quantity]))
  );
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [stage, setStage] = useState<
    | { s: "picking" }
    | { s: "starting" }
    | { s: "paying"; clientSecret: string; paymentIntentId: string; amount: number }
    | { s: "done"; tickets: IssuedTicket[] }
  >({ s: "picking" });
  const [error, setError] = useState<string | null>(null);

  const accountEmail = user?.emailAddresses?.[0]?.emailAddress ?? "";
  const effectiveEmail = (email || accountEmail).trim();

  const lines = useMemo(
    () => types.map((t) => ({ type: t, n: qty[t.id] ?? 0 })).filter((l) => l.n > 0),
    [types, qty]
  );
  const total = lines.reduce((sum, l) => sum + l.type.priceCents * l.n, 0);
  const count = lines.reduce((n, l) => n + l.n, 0);

  function bump(t: PublicTicketType, delta: number) {
    setQty((q) => {
      const ceiling = Math.min(t.maxPerOrder, t.remaining ?? t.maxPerOrder);
      return { ...q, [t.id]: Math.max(0, Math.min(ceiling, (q[t.id] ?? 0) + delta)) };
    });
  }

  async function start() {
    setError(null);
    if (count === 0) return setError("Pick at least one ticket.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(effectiveEmail)) {
      return setError("Enter the email your tickets should go to.");
    }

    setStage({ s: "starting" });
    try {
      const res = await fetch("/api/tickets/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          email: effectiveEmail,
          name: name.trim() || undefined,
          lines: lines.map((l) => ({ ticketTypeId: l.type.id, quantity: l.n })),
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.message ?? data.error ?? "Couldn't start checkout.");
        return setStage({ s: "picking" });
      }
      if (data.free) return setStage({ s: "done", tickets: data.tickets ?? [] });
      setStage({ s: "paying", clientSecret: data.clientSecret, paymentIntentId: data.paymentIntentId, amount: data.amount });
    } catch {
      setError("Couldn't start checkout. Please try again.");
      setStage({ s: "picking" });
    }
  }

  if (stage.s === "done") {
    return <Issued tickets={stage.tickets} email={effectiveEmail} eventTitle={eventTitle} signedIn={!!isSignedIn} />;
  }

  return (
    <div className="mt-5 space-y-4">
      <ul className="space-y-2">
        {types.map((t) => {
          const n = qty[t.id] ?? 0;
          const unavailable = t.soldOut || t.closed;
          return (
            <li
              key={t.id}
              className={
                "flex items-center gap-3 rounded-xl border px-3 py-3 " +
                (unavailable ? "border-stone-100 bg-stone-50 opacity-60" : "border-stone-200 bg-white")
              }
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-stone-900">{t.name}</p>
                {t.description && <p className="text-xs text-stone-500">{t.description}</p>}
                <p className="mt-0.5 text-xs font-semibold text-stone-700">
                  {t.priceCents === 0 ? "Free" : money(t.priceCents)}
                </p>
              </div>
              {!unavailable && stage.s === "picking" && (
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
              {stage.s !== "picking" && n > 0 && (
                <span className="shrink-0 text-sm font-semibold tabular-nums text-stone-700">× {n}</span>
              )}
            </li>
          );
        })}
      </ul>

      {stage.s === "picking" || stage.s === "starting" ? (
        <div className="rounded-2xl border border-stone-200 bg-white p-4">
          <label className="block text-xs font-medium text-stone-600" htmlFor="ticket-email">
            Email for your tickets
          </label>
          <input
            id="ticket-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email || accountEmail}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2.5 text-sm"
          />
          <label className="mt-3 block text-xs font-medium text-stone-600" htmlFor="ticket-name">
            Name <span className="font-normal text-stone-400">(so the door knows who you are)</span>
          </label>
          <input
            id="ticket-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={user?.firstName ?? "Your name"}
            className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2.5 text-sm"
          />

          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="text-stone-500">
              {count} {count === 1 ? "ticket" : "tickets"}
            </span>
            <span className="text-base font-semibold text-stone-900">{total === 0 ? "Free" : money(total)}</span>
          </div>

          {error && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

          <button
            onClick={start}
            disabled={stage.s === "starting" || count === 0}
            className="mt-3 w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {stage.s === "starting" ? "One moment…" : total === 0 ? "Get tickets" : "Continue to payment"}
          </button>
          {!isSignedIn && (
            <p className="mt-2 text-center text-xs text-stone-500">
              No account needed. We&apos;ll email your tickets — sign in later with the same address to find them again.
            </p>
          )}
        </div>
      ) : stage.s === "paying" ? (
        <Elements stripe={stripePromise} options={{ clientSecret: stage.clientSecret }}>
          <PayForm
            clientSecret={stage.clientSecret}
            paymentIntentId={stage.paymentIntentId}
            amount={stage.amount}
            onIssued={(tickets) => setStage({ s: "done", tickets })}
          />
        </Elements>
      ) : null}
    </div>
  );
}

function PayForm({
  clientSecret,
  paymentIntentId,
  amount,
  onIssued,
}: {
  clientSecret: string;
  paymentIntentId: string;
  amount: number;
  onIssued: (tickets: IssuedTicket[]) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setPaying(true);
    setError(null);

    const { error: submitError } = await elements.submit();
    if (submitError) {
      setError(submitError.message ?? "Payment failed");
      return setPaying(false);
    }

    const { error: confirmError } = await stripe.confirmPayment({
      elements,
      clientSecret,
      confirmParams: { return_url: `${window.location.origin}/tickets` },
      redirect: "if_required",
    });
    if (confirmError) {
      setError(confirmError.message ?? "Payment failed");
      return setPaying(false);
    }

    // The payment succeeded either way at this point. If issuing hiccups, the
    // Stripe webhook still issues and emails the tickets, so the message says
    // "check your email" rather than implying the money didn't land.
    try {
      const res = await fetch("/api/tickets/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentIntentId }),
      });
      const data = await res.json();
      if (data.success) onIssued(data.tickets ?? []);
      else setError("Payment went through — your tickets are on their way by email.");
    } catch {
      setError("Payment went through — your tickets are on their way by email.");
    }
    setPaying(false);
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-stone-200 bg-white p-4">
      <PaymentElement />
      {error && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      <button
        type="submit"
        disabled={paying || !stripe}
        className="mt-4 w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
      >
        {paying ? "Processing…" : `Pay ${money(amount)}`}
      </button>
    </form>
  );
}

function Issued({
  tickets,
  email,
  eventTitle,
  signedIn,
}: {
  tickets: IssuedTicket[];
  email: string;
  eventTitle: string;
  signedIn: boolean;
}) {
  return (
    <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center">
      <CheckCircle2 className="mx-auto h-9 w-9 text-emerald-600" />
      <p className="mt-2 text-lg font-semibold text-stone-900">
        You&apos;re going to {eventTitle}
      </p>
      <p className="mt-1 text-sm text-stone-600">
        {tickets.length} {tickets.length === 1 ? "ticket" : "tickets"} sent to {email}
      </p>

      <ul className="mt-4 space-y-2 text-left">
        {tickets.map((t) => (
          <li key={t.token}>
            <Link
              href={`/tickets/${t.token}`}
              className="flex items-center gap-3 rounded-xl bg-white px-3 py-2.5 hover:bg-stone-50"
            >
              <TicketIcon className="h-4 w-4 shrink-0 text-indigo-600" />
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-stone-900">
                {t.typeName ?? "Ticket"}
              </span>
              <span className="shrink-0 font-mono text-xs tracking-wider text-stone-500">{t.code}</span>
            </Link>
          </li>
        ))}
      </ul>

      <Link
        href="/tickets"
        className="mt-4 inline-block rounded-xl bg-stone-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-stone-800"
      >
        {signedIn ? "See all my tickets" : "Save these tickets"}
      </Link>
    </div>
  );
}
