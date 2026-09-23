"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { BadgeCheck, Check, Loader2, Search } from "lucide-react";
import { useUser } from "@clerk/nextjs";
import { useLogin } from "@/components/auth/ClerkAuthProvider";
import { useMembershipPlans } from "@/lib/data-hooks";
import type { PublicMembershipPlan } from "@/app/api/memberships/plans/route";

const CATEGORIES = ["All", "Fitness", "Classes", "Food & drink", "Wellness", "Creative"];

export function MembershipsMarketplace() {
  const { plans, loading } = useMembershipPlans();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return plans.filter((plan) => {
      const haystack = [
        plan.name,
        plan.description,
        plan.memberName,
        plan.memberCategory,
        ...plan.perks,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const matchesQuery = !q || haystack.includes(q);
      const matchesCategory =
        category === "All" || categoryMatches(category, plan.memberCategory, haystack);
      return matchesQuery && matchesCategory;
    });
  }, [category, plans, query]);

  // Every plan a placeholder means nobody has published one yet.
  const allExamples = plans.length > 0 && plans.every((plan) => plan.demo);

  return (
    <main className="min-h-screen bg-stone-50 pb-24 pt-6">
      <div className="mx-auto max-w-6xl px-4 md:px-8">
        <div className="mb-5">
          <p className="t-meta font-semibold uppercase tracking-[0.18em] text-coral-700">
            Local memberships
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-stone-950 md:text-5xl">
            Browse memberships
          </h1>
          <p className="mt-2 max-w-2xl t-body text-stone-600">
            Find recurring plans from gyms, studios, classes, and neighborhood businesses.
          </p>
        </div>

        <section>
          <div className="flex items-center gap-2 rounded-full border border-stone-200 bg-white p-1.5 pl-4 shadow-[var(--shadow-soft)]">
            <Search className="h-5 w-5 shrink-0 text-stone-500" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search memberships, studios, perks"
              aria-label="Search memberships"
              className="min-w-0 flex-1 bg-transparent px-3 py-2 t-body text-stone-900 placeholder-stone-400 focus:outline-none"
            />
          </div>
          <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden">
            {CATEGORIES.map((item) => {
              const active = category === item;
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => setCategory(item)}
                  className={
                    "shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition " +
                    (active
                      ? "bg-stone-950 text-white shadow-[var(--shadow-soft)]"
                      : "bg-white text-stone-600 ring-1 ring-stone-200 hover:text-stone-950")
                  }
                >
                  {item}
                </button>
              );
            })}
          </div>
        </section>

        <section className="mt-6">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <p className="t-meta font-semibold uppercase tracking-[0.16em] text-coral-700">
                {allExamples ? "Coming soon" : "Available locally"}
              </p>
              <h2 className="text-2xl font-semibold tracking-tight text-stone-950">
                Memberships to browse
              </h2>
              {/* Don't let three placeholders read as three real offers. */}
              {allExamples && (
                <p className="mt-1 t-meta text-stone-500">
                  No business nearby has published a membership yet — here is what
                  one looks like.
                </p>
              )}
            </div>
            <p className="shrink-0 t-meta font-semibold text-stone-500">
              {filtered.length} {filtered.length === 1 ? "plan" : "plans"}
            </p>
          </div>

          {loading && plans.length === 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="h-80 animate-pulse rounded-3xl bg-stone-200" />
              ))}
            </div>
          ) : filtered.length ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filtered.map((plan) => (
                <MembershipBrowseCard key={plan.id} plan={plan} />
              ))}
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-stone-300 bg-white p-8 text-center">
              <h3 className="text-lg font-semibold text-stone-950">No memberships found</h3>
              <p className="mt-2 text-sm text-stone-500">Try another search or category.</p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function MembershipBrowseCard({ plan }: { plan: PublicMembershipPlan }) {
  const { isSignedIn } = useUser();
  const openLogin = useLogin();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const perks = [
    ...(plan.discount_percent ? [`${plan.discount_percent}% off checkout`] : []),
    ...plan.perks,
  ].slice(0, 4);

  async function join() {
    if (!isSignedIn) {
      openLogin({ redirectUrl: "/memberships" });
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/memberships/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: plan.id, returnPath: "/memberships" }),
      });
      const data = await response.json();
      if (data.url) {
        window.location.assign(data.url);
        return;
      }
      setError(
        data.error === "vendor_not_ready"
          ? "This business can't take payments yet."
          : data.error === "already_member"
            ? "You're already a member here."
            : "Couldn't start that just now.",
      );
    } catch {
      setError("Couldn't start that just now.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="flex min-h-[27rem] flex-col overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-[var(--shadow-soft)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]">
      <Link href={`/members/${plan.member_id}`} className="group block">
        <div className={`relative h-40 bg-gradient-to-br ${gradientFor(plan.memberName)}`}>
          {plan.memberImage && (
            <Image
              src={plan.memberImage}
              alt={plan.memberName}
              fill
              sizes="(min-width:1024px) 33vw, (min-width:768px) 50vw, 100vw"
              className="object-cover transition duration-300 group-hover:scale-105"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-stone-950/70 via-stone-950/10 to-transparent" />
          <div className="absolute bottom-4 left-4 right-4">
            <p className="truncate text-xs font-semibold uppercase tracking-wide text-white/75">
              {plan.memberCategory || "Local business"}
            </p>
            <p className="truncate text-lg font-semibold text-white">{plan.memberName}</p>
          </div>
        </div>
      </Link>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold tracking-tight text-stone-950">{plan.name}</h3>
            {plan.description && (
              <p className="mt-1 line-clamp-2 text-sm leading-5 text-stone-500">{plan.description}</p>
            )}
          </div>
          <span className="shrink-0 rounded-full bg-coral-50 px-2.5 py-1 text-sm font-semibold text-coral-700">
            {membershipPriceLabel(plan)}
          </span>
        </div>

        {perks.length > 0 && (
          <ul className="mt-4 space-y-2">
            {perks.map((perk, index) => (
              <li key={`${perk}-${index}`} className="flex items-start gap-2 text-sm text-stone-700">
                {index === 0 && plan.discount_percent ? (
                  <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-coral-600" />
                ) : (
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-stone-400" />
                )}
                <span className="line-clamp-1">{perk}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-auto grid gap-2 pt-5">
          {/* A placeholder plan has no row behind it, so Join could only ever
              fail. Show what the page is for and send them to the business
              instead of handing them a button that 404s. */}
          {plan.demo ? (
            <p className="rounded-full bg-stone-100 px-4 py-2.5 text-center text-sm font-semibold text-stone-500">
              Example membership
            </p>
          ) : (
            <button
              type="button"
              onClick={() => void join()}
              disabled={busy}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-stone-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-stone-800 disabled:opacity-60"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Join membership
            </button>
          )}
          <Link
            href={`/members/${plan.member_id}`}
            className="inline-flex w-full items-center justify-center rounded-full border border-stone-200 px-4 py-2.5 text-sm font-semibold text-stone-700 transition hover:border-stone-300 hover:bg-stone-50"
          >
            View business
          </Link>
        </div>
        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      </div>
    </article>
  );
}

function categoryMatches(category: string, memberCategory: string | null, haystack: string) {
  const source = `${memberCategory ?? ""} ${haystack}`.toLowerCase();
  if (category === "Fitness") return /gym|mma|fitness|training|martial|yoga/.test(source);
  if (category === "Classes") return /class|workshop|studio|lesson|pottery|course/.test(source);
  if (category === "Food & drink") return /bar|restaurant|food|drink|cafe|cantina|pub/.test(source);
  if (category === "Wellness") return /wellness|spa|salon|yoga|health|therapy/.test(source);
  if (category === "Creative") return /art|creative|maker|music|plant|pottery/.test(source);
  return true;
}

function membershipPriceLabel(plan: PublicMembershipPlan): string {
  const dollars = plan.price_cents / 100;
  const price = dollars % 1 === 0 ? `$${dollars}` : `$${dollars.toFixed(2)}`;
  return `${price}/${plan.billing_interval === "year" ? "yr" : "mo"}`;
}

const CARD_GRADIENTS = [
  "from-amber-200 to-orange-300",
  "from-sky-200 to-blue-300",
  "from-violet-200 to-purple-300",
  "from-emerald-200 to-teal-300",
  "from-rose-200 to-pink-300",
  "from-lime-200 to-emerald-300",
];

function gradientFor(seed: string): string {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return CARD_GRADIENTS[hash % CARD_GRADIENTS.length];
}
