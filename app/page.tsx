"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { LayoutGrid, Map as MapIcon, ShoppingBag, Plane, Heart, Apple, DollarSign, CreditCard, X } from "lucide-react";
import { listMembers } from "@/lib/api";
import type { Member } from "@/lib/types";
import { MemberCard, MemberCardSkeleton } from "@/components/MemberCard";
import { FilterBar, type FilterType } from "@/components/FilterBar";
import { MapView } from "@/components/MapView";
import { DEMO_MEMBERS } from "@/lib/demo-members";

type ViewMode = "grid" | "map";

// Module-level cache survives across re-mounts (e.g. when navigating back to /).
// Keyed by JSON of filter params.
const memberCache = new Map<string, Member[]>();

export default function BrowsePage() {
  const [type, setType] = useState<FilterType>("all");
  const [city, setCity] = useState("");
  const [category, setCategory] = useState("");
  const [subcategory, setSubcategory] = useState("");
  const [view, setView] = useState<ViewMode>("grid");
  const cacheKey = JSON.stringify({ type, city, category, subcategory });
  const cached = memberCache.get(cacheKey);
  const [members, setMembers] = useState<Member[]>(cached ?? []);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState<string | null>(null);
  const [donateOpen, setDonateOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const hit = memberCache.get(cacheKey);
    if (hit) {
      setMembers(hit);
      setLoading(false);
      // stale-while-revalidate: refresh silently in background
    } else {
      setLoading(true);
    }
    setError(null);
    listMembers({
      type,
      city: city || undefined,
      category: category || undefined,
      subcategory: subcategory || undefined,
      limit: 100,
    })
      .then((res) => {
        if (cancelled) return;
        memberCache.set(cacheKey, res.members);
        setMembers(res.members);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Failed to load members.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [type, city, category, subcategory, cacheKey]);

  const visible = useMemo(() => {
    const real = members.filter((m) => m.profile?.name);
    const demos = DEMO_MEMBERS.filter((m) => type === "all" || m.profile?.memberType === type);
    return [...real, ...demos];
  }, [members, type]);

  return (
    <div className="mx-auto max-w-7xl px-4 pb-20 md:px-8">
      {/* Gradient hero */}
      <section className="relative -mx-4 mb-10 overflow-hidden rounded-b-[2.5rem] md:-mx-8 md:mt-6 md:rounded-[2.5rem]">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 via-sky-50 to-violet-50" />
        <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-teal-300/40 blur-3xl" />
        <div className="absolute right-[-6rem] top-10 h-80 w-80 rounded-full bg-sky-300/40 blur-3xl" />
        <div className="absolute bottom-[-6rem] left-1/3 h-72 w-72 rounded-full bg-violet-300/40 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.06] [background-image:radial-gradient(circle_at_1px_1px,#0f172a_1px,transparent_0)] [background-size:22px_22px]" />
        <div className="relative py-16 md:py-24">
          <div className="mx-auto max-w-3xl px-6 text-center">
            <h1 className="text-5xl font-semibold leading-[1.05] tracking-tight text-stone-900 md:text-7xl">
              Discover Your{" "}
              <span className="bg-gradient-to-r from-teal-600 via-sky-600 to-violet-600 bg-clip-text text-transparent">
                Community
              </span>
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-base text-stone-600 md:text-lg">
              Browse the makers, community, vendors, and neighbors building local life around you.
            </p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-2">
              <Link
                href="/shop"
                className="inline-flex items-center gap-2 rounded-full bg-white/90 px-5 py-2.5 text-sm font-medium text-stone-800 ring-1 ring-stone-200 shadow-sm backdrop-blur transition-all hover:ring-stone-300 hover:shadow-md hover:-translate-y-0.5"
              >
                <ShoppingBag className="h-4 w-4" /> Merch
              </Link>
              <Link
                href="/travel"
                className="inline-flex items-center gap-2 rounded-full bg-white/90 px-5 py-2.5 text-sm font-medium text-stone-800 ring-1 ring-stone-200 shadow-sm backdrop-blur transition-all hover:ring-stone-300 hover:shadow-md hover:-translate-y-0.5"
              >
                <Plane className="h-4 w-4" /> Travel
              </Link>
              <div className="inline-flex shrink-0 items-center gap-2 rounded-full bg-gradient-to-r from-pink-500 to-purple-600 py-2 pl-5 pr-1.5 text-sm font-medium text-white shadow-lg shadow-purple-500/25 ring-1 ring-purple-400/40 transition-all hover:from-pink-400 hover:to-purple-500 hover:shadow-xl hover:-translate-y-0.5">
                <button
                  type="button"
                  onClick={() => setDonateOpen(true)}
                  className="inline-flex items-center gap-2"
                >
                  <Heart className="h-4 w-4" /> Support
                </button>
                <Link
                  href="/mission"
                  className="ml-1 inline-flex items-center rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-purple-700 transition hover:bg-white"
                >
                  the Mission
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {donateOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 p-4 backdrop-blur-sm"
          onClick={() => setDonateOpen(false)}
        >
          <div
            className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-pink-500 to-purple-600 p-6 text-white">
              <button
                aria-label="Close"
                onClick={() => setDonateOpen(false)}
                className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white transition hover:bg-white/30"
              >
                <X className="h-4 w-4" />
              </button>
              <Heart className="h-7 w-7" />
              <h2 className="mt-3 text-xl font-semibold">Support the Mission</h2>
              <p className="mt-1 text-sm text-white/90">
                Help us keep building local community. Choose a payment method below.
              </p>
            </div>
            <div className="space-y-3 p-6">
              <div className="flex items-center justify-between gap-2">
                {[25, 50, 100].map((amt) => (
                  <button
                    key={amt}
                    className="flex-1 rounded-xl border border-stone-200 bg-stone-50 py-2 text-sm font-semibold text-stone-800 transition hover:border-purple-300 hover:bg-purple-50"
                  >
                    ${amt}
                  </button>
                ))}
              </div>
              <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-stone-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-stone-800">
                <Apple className="h-4 w-4" /> Pay with Apple Pay
              </button>
              <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-600">
                <DollarSign className="h-4 w-4" /> Pay with Cash App
              </button>
              <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700">
                <CreditCard className="h-4 w-4" /> Pay with Visa
              </button>
              <p className="pt-1 text-center text-xs text-stone-400">
                Demo only — Stripe integration coming soon.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Filters + view toggle */}
      <section className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <FilterBar
            type={type}
            city={city}
            category={category}
            subcategory={subcategory}
            onTypeChange={(t) => { setType(t); setCategory(""); setSubcategory(""); }}
            onCityChange={setCity}
            onCategoryChange={(c) => { setCategory(c); setSubcategory(""); }}
            onSubcategoryChange={setSubcategory}
          />
          <div className="hidden shrink-0 rounded-full border border-stone-200 bg-white p-1 md:flex">
            <ToggleBtn active={view === "grid"} onClick={() => setView("grid")}>
              <LayoutGrid className="h-4 w-4" /> Grid
            </ToggleBtn>
            <ToggleBtn active={view === "map"} onClick={() => setView("map")}>
              <MapIcon className="h-4 w-4" /> Map
            </ToggleBtn>
          </div>
        </div>
      </section>

      {/* Results */}
      <section className="mt-8">
        {error && visible.length === 0 && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {error}
          </div>
        )}

        {view === "map" && visible.length > 0 && (
          <MapView members={visible} />
        )}

        {view === "grid" && loading && visible.length === 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <MemberCardSkeleton key={i} />
            ))}
          </div>
        )}

        {view === "grid" && !loading && visible.length === 0 && !error && (
          <div className="rounded-2xl border border-dashed border-stone-300 bg-white/60 p-12 text-center">
            <p className="text-base font-medium text-stone-800">No members match your filters yet.</p>
            <p className="mt-1 text-sm text-stone-500">
              Try clearing the city filter or selecting a different category.
            </p>
          </div>
        )}

        {view === "grid" && visible.length > 0 && (
          <div className="grid auto-rows-fr grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {visible.map((m) => (
              <MemberCard key={m.id} member={m} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ToggleBtn({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition " +
        (active ? "bg-indigo-600 text-white" : "text-stone-600 hover:text-stone-900")
      }
    >
      {children}
    </button>
  );
}
