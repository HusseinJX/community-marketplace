"use client";

import useSWR from "swr";
import Link from "next/link";
import { useState } from "react";
import { BadgeCheck, Check, Loader2, ArrowRight } from "lucide-react";
import { BackToHome } from "@/components/BackToHome";

interface Row {
  id: string;
  member_id: string;
  plan_name: string;
  business_name: string;
  perks: string[];
  discount_percent: number | null;
  status: string;
  cancel_at_period_end: boolean;
  current_period_end: string | null;
  price_cents: number;
  billing_interval: string;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function renewLabel(row: Row) {
  if (!row.current_period_end) return null;
  const when = new Date(row.current_period_end).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  if (row.cancel_at_period_end) return `Ends ${when}`;
  if (row.status === "past_due") return `Payment failed — retrying until ${when}`;
  return `Renews ${when}`;
}

export function MembershipsClient() {
  const { data, isLoading, mutate } = useSWR<{ memberships: Row[] }>("/api/memberships", fetcher);
  const [busy, setBusy] = useState<string | null>(null);

  const rows = data?.memberships ?? [];
  // A cancelled membership stays visible until its period runs out — they paid
  // for those days and the perks are still theirs.
  const live = rows.filter((r) => ["active", "trialing", "past_due"].includes(r.status));
  const past = rows.filter((r) => !live.includes(r));

  async function toggle(row: Row) {
    setBusy(row.id);
    await fetch("/api/memberships/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ membershipId: row.id, resume: row.cancel_at_period_end }),
    });
    await mutate();
    setBusy(null);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 md:px-8">
      <BackToHome href="/shopper" label="Your space" />

      <div>
        <h1 className="text-xl font-semibold text-stone-900">Your memberships</h1>
        <p className="mt-1 t-meta text-stone-500">
          The businesses you support every month, and what each one gives you back.
        </p>
      </div>

      {isLoading && <p className="t-meta text-stone-400">Loading…</p>}

      {!isLoading && !rows.length && (
        <div className="card-soft p-6 text-center">
          <p className="t-lead text-stone-900">No memberships yet</p>
          <p className="mt-1 t-meta text-stone-500">
            Some local businesses offer one — a discount on everything, perks for regulars. You&apos;ll
            find them on their profile.
          </p>
          <Link
            href="/explore"
            className="mt-4 inline-flex items-center justify-center rounded-full bg-stone-900 px-5 py-2.5 t-meta font-semibold text-white transition hover:bg-stone-800"
          >
            Browse local businesses
          </Link>
        </div>
      )}

      {live.map((row) => (
        <div key={row.id} className="card-soft p-4">
          <div className="flex items-baseline justify-between gap-3">
            <Link href={`/members/${row.member_id}`} className="t-strong text-stone-900 hover:underline">
              {row.business_name}
            </Link>
            <span className="shrink-0 t-meta text-stone-500">
              ${(row.price_cents / 100).toFixed(2)}/{row.billing_interval === "year" ? "yr" : "mo"}
            </span>
          </div>
          <p className="mt-0.5 t-meta text-stone-500">{row.plan_name}</p>

          <ul className="mt-3 space-y-1.5">
            {!!row.discount_percent && (
              <li className="flex items-start gap-2 t-meta text-stone-700">
                <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-teal-500" />
                <span>
                  <span className="font-semibold">{row.discount_percent}% off</span> — taken off
                  automatically when you buy from them.
                </span>
              </li>
            )}
            {row.perks.map((perk, i) => (
              <li key={i} className="flex items-start gap-2 t-meta text-stone-700">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-stone-400" />
                <span>{perk}</span>
              </li>
            ))}
          </ul>

          <div className="mt-4 flex items-center justify-between gap-3 border-t border-stone-100 pt-3">
            <span className="t-meta text-stone-400">{renewLabel(row)}</span>
            <button
              onClick={() => toggle(row)}
              disabled={busy === row.id}
              className="inline-flex items-center gap-1.5 t-meta font-medium text-stone-500 underline underline-offset-2 hover:text-stone-900 disabled:opacity-50"
            >
              {busy === row.id && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {row.cancel_at_period_end ? "Keep it" : "Cancel"}
            </button>
          </div>
        </div>
      ))}

      {past.length > 0 && (
        <div>
          <p className="section-label mb-3">Ended</p>
          <div className="space-y-2">
            {past.map((row) => (
              <Link
                key={row.id}
                href={`/members/${row.member_id}`}
                className="card-soft card-hover flex items-center justify-between p-4"
              >
                <span>
                  <span className="block t-strong text-stone-900">{row.business_name}</span>
                  <span className="block t-meta text-stone-500">{row.plan_name} · ended</span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-stone-400" />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
