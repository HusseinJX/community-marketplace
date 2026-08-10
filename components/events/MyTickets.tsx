"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Ticket as TicketIcon, Calendar, CheckCircle2 } from "lucide-react";
import { useAuth } from "@clerk/nextjs";
import { useLogin } from "@/components/auth/ClerkAuthProvider";
import { sfToday } from "@/lib/sf-date";

interface MyTicket {
  token: string;
  code: string;
  typeName: string | null;
  status: string;
  checkedInAt: string | null;
  priceCents: number;
  event: {
    id: string;
    title: string;
    date: string | null;
    time: string | null;
    location: string | null;
    hostName: string | null;
    poster: string | null;
  };
}

export function MyTickets() {
  const { isSignedIn, isLoaded } = useAuth();
  const openLogin = useLogin();
  const [tickets, setTickets] = useState<MyTicket[] | null>(null);

  useEffect(() => {
    if (!isSignedIn) return;
    fetch("/api/tickets/mine")
      .then((r) => (r.ok ? r.json() : { tickets: [] }))
      .then((d) => setTickets(Array.isArray(d.tickets) ? d.tickets : []))
      .catch(() => setTickets([]));
  }, [isSignedIn]);

  if (isLoaded && !isSignedIn) {
    return (
      <div className="mt-6 rounded-2xl border border-stone-200 bg-white p-6 text-center">
        <TicketIcon className="mx-auto h-8 w-8 text-stone-300" />
        <p className="mt-2 text-sm text-stone-600">
          Sign in with the email you used at checkout and your tickets will be here.
        </p>
        <button
          onClick={() => openLogin()}
          className="mt-4 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          Sign in
        </button>
        <p className="mt-3 text-xs text-stone-500">
          Bought as a guest? The link in your confirmation email still works on its own.
        </p>
      </div>
    );
  }

  if (tickets === null) {
    return <p className="mt-6 text-sm text-stone-400">Loading…</p>;
  }

  if (tickets.length === 0) {
    return (
      <div className="mt-6 rounded-2xl border border-stone-200 bg-white p-6 text-center">
        <TicketIcon className="mx-auto h-8 w-8 text-stone-300" />
        <p className="mt-2 text-sm text-stone-600">No tickets yet.</p>
        <Link
          href="/?tab=events"
          className="mt-4 inline-block rounded-xl bg-stone-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-stone-800"
        >
          Find something to do
        </Link>
      </div>
    );
  }

  // Event dates are city-local free text (see lib/sf-date) — a date we can't
  // read counts as upcoming, because hiding a ticket someone still needs is far
  // worse than leaving a stale one on the list.
  const today = sfToday();
  const upcoming = tickets.filter((t) => !isPast(t.event.date, today));
  const past = tickets.filter((t) => isPast(t.event.date, today));

  return (
    <div className="mt-5 space-y-6">
      {upcoming.length > 0 && <Section title="Upcoming" tickets={upcoming} />}
      {past.length > 0 && <Section title="Been there" tickets={past} muted />}
    </div>
  );
}

function isPast(date: string | null, today: string): boolean {
  if (!date) return false;
  const iso = /^\d{4}-\d{2}-\d{2}/.exec(date)?.[0];
  if (iso) return iso < today;
  const parsed = Date.parse(date);
  if (Number.isNaN(parsed)) return false;
  return new Date(parsed).toISOString().slice(0, 10) < today;
}

function Section({ title, tickets, muted }: { title: string; tickets: MyTicket[]; muted?: boolean }) {
  return (
    <section>
      <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-400">{title}</h2>
      <ul className={"mt-2 space-y-2 " + (muted ? "opacity-70" : "")}>
        {tickets.map((t) => (
          <li key={t.token}>
            <Link
              href={`/tickets/${t.token}`}
              className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-white px-4 py-3 hover:border-stone-300"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-stone-900">{t.event.title}</p>
                <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-stone-500">
                  <Calendar className="h-3 w-3 shrink-0" />
                  {[t.event.date, t.event.time, t.event.location].filter(Boolean).join(" · ") || "Date TBC"}
                </p>
                <p className="mt-1 flex items-center gap-2 text-xs">
                  <span className="rounded bg-stone-100 px-1.5 py-0.5 font-medium text-stone-600">
                    {t.typeName ?? "Admission"}
                  </span>
                  <span className="font-mono tracking-wider text-stone-400">{t.code}</span>
                  {t.status === "checked_in" && (
                    <span className="inline-flex items-center gap-1 text-emerald-600">
                      <CheckCircle2 className="h-3 w-3" /> Checked in
                    </span>
                  )}
                </p>
              </div>
              <TicketIcon className="h-4 w-4 shrink-0 text-indigo-500" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
