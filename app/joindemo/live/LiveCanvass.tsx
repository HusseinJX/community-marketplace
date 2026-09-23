"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Globe,
  Loader2,
  MapPin,
  Phone,
  Search,
  Sparkles,
  Star,
} from "lucide-react";
import { useLogin } from "@/components/auth/ClerkAuthProvider";

interface Candidate {
  placeId: string;
  name: string;
  address: string;
  rating: number | null;
  userRatingsTotal: number | null;
  types: string[];
  businessStatus: string | null;
}

interface Details {
  placeId: string;
  name: string;
  address: string | null;
  phone: string | null;
  website: string | null;
  hours: string | null;
  summary: string | null;
  rating: number | null;
  userRatingsTotal: number | null;
  types: string[];
  city: string | null;
  neighborhood: string | null;
}

interface Lookup {
  details: Details;
  research: string | null;
  researchFailed?: boolean;
  duplicate: { id: string; name: string } | null;
}

interface Created {
  memberId: string;
  name: string;
  storySaved: boolean;
  url: string;
}

export function LiveCanvass({ canCreate, signedIn }: { canCreate: boolean; signedIn: boolean }) {
  const openLogin = useLogin();
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [lookup, setLookup] = useState<Lookup | null>(null);
  const [looking, setLooking] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<Created | null>(null);
  const [error, setError] = useState<string | null>(null);

  // On submit, never on keystroke. Every one of these is a billed Google call
  // (lib/places.ts owns the spending rules).
  async function search(event?: React.FormEvent) {
    event?.preventDefault();
    const q = query.trim();
    if (q.length < 3) return;
    setSearching(true);
    setError(null);
    setCandidates(null);
    setLookup(null);
    setCreated(null);
    try {
      const res = await fetch(`/api/places/search?q=${encodeURIComponent(q)}&region=us`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Search failed");
      setCandidates(data.results ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setSearching(false);
    }
  }

  async function pick(placeId: string, keepDetails = false) {
    setLooking(!keepDetails);
    setRetrying(keepDetails);
    setError(null);
    setLookup(null);
    setCreated(null);
    try {
      const res = await fetch("/api/joindemo/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placeId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Lookup failed");
      setLookup(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lookup failed");
    } finally {
      setLooking(false);
      setRetrying(false);
    }
  }

  async function create(force = false) {
    if (!lookup) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/joindemo/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placeId: lookup.details.placeId, force }),
      });
      const data = await res.json();
      if (res.status === 409) {
        setError(`Already in the directory as "${data.existing?.name}". Use Create anyway to add a second.`);
        return;
      }
      if (!res.ok) throw new Error(data.message ?? data.error ?? "Create failed");
      setCreated(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setCreating(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 md:px-8">
      <div>
        <p className="t-meta font-semibold uppercase tracking-[0.16em] text-coral-700">
          Live canvass
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-stone-950">
          Someone names a spot — put it on the map
        </h1>
        <p className="mt-1 t-meta text-stone-500">
          Find it on Google Maps, read what the web knows about them, then create
          their unclaimed profile. This one is real: it writes to the directory.
        </p>
      </div>

      {!canCreate && (
        <div className="mt-4 flex items-start gap-3 rounded-2xl bg-amber-50 px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div className="text-sm text-amber-900">
            <p className="font-semibold">
              {signedIn ? "This account can't create profiles." : "You're not signed in."}
            </p>
            <p className="mt-0.5">
              Search and research work. Creating needs an admin account.{" "}
              {!signedIn && (
                <button
                  type="button"
                  onClick={() => openLogin({ redirectUrl: "/joindemo/live" })}
                  className="font-semibold underline"
                >
                  Sign in
                </button>
              )}
            </p>
          </div>
        </div>
      )}

      <form onSubmit={search} className="mt-5 flex gap-2 rounded-2xl border border-stone-200 bg-white p-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Business name, and the city or street"
          className="min-w-0 flex-1 bg-transparent px-3 t-body text-stone-900 placeholder-stone-400 focus:outline-none"
        />
        <button
          type="submit"
          disabled={searching || query.trim().length < 3}
          className="inline-flex items-center gap-2 rounded-full bg-stone-950 px-4 py-2 t-meta font-semibold text-white transition hover:bg-stone-800 disabled:opacity-50"
        >
          {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Find it
        </button>
      </form>

      {error && (
        <p className="mt-3 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      )}

      {/* ── Candidates ─────────────────────────────────────────────────── */}
      {candidates && !lookup && !looking && (
        <div className="mt-5 space-y-2">
          {candidates.length === 0 && (
            <p className="rounded-2xl border border-dashed border-stone-300 bg-white p-5 text-center text-sm text-stone-500">
              Nothing on Maps for that. Try adding the street or the city.
            </p>
          )}
          {candidates.map((c) => (
            <button
              key={c.placeId}
              type="button"
              onClick={() => void pick(c.placeId)}
              className="flex w-full items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white p-4 text-left transition hover:border-stone-300 hover:shadow-[var(--shadow-soft)]"
            >
              <span className="min-w-0">
                <span className="block font-semibold text-stone-950">{c.name}</span>
                <span className="mt-0.5 block truncate text-sm text-stone-500">{c.address}</span>
                {c.rating != null && (
                  <span className="mt-1 inline-flex items-center gap-1 text-xs text-stone-500">
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                    {c.rating} · {c.userRatingsTotal ?? 0} reviews
                  </span>
                )}
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-stone-400" />
            </button>
          ))}
        </div>
      )}

      {looking && (
        <div className="mt-5 rounded-3xl border border-stone-200 bg-white p-6">
          <p className="flex items-center gap-2 text-sm font-semibold text-stone-700">
            <Loader2 className="h-4 w-4 animate-spin" />
            Reading Maps and searching the web for their story…
          </p>
          <div className="mt-4 space-y-2">
            <div className="h-3 w-3/4 animate-pulse rounded bg-stone-100" />
            <div className="h-3 w-full animate-pulse rounded bg-stone-100" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-stone-100" />
          </div>
        </div>
      )}

      {/* ── Review: the facts and the story, before anything is written ── */}
      {lookup && !created && (
        <div className="mt-5 space-y-4">
          {lookup.duplicate && (
            <div className="flex items-start gap-3 rounded-2xl bg-amber-50 px-4 py-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <p className="text-sm text-amber-900">
                Already in the directory as{" "}
                <Link href={`/members/${lookup.duplicate.id}`} className="font-semibold underline">
                  {lookup.duplicate.name}
                </Link>
                . Creating again makes a second page.
              </p>
            </div>
          )}

          <section className="rounded-3xl border border-stone-200 bg-white p-5">
            <h2 className="text-lg font-semibold text-stone-950">{lookup.details.name}</h2>
            <dl className="mt-3 space-y-2 text-sm text-stone-600">
              {lookup.details.address && (
                <div className="flex gap-2">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-stone-400" />
                  <dd>{lookup.details.address}</dd>
                </div>
              )}
              {lookup.details.phone && (
                <div className="flex gap-2">
                  <Phone className="mt-0.5 h-4 w-4 shrink-0 text-stone-400" />
                  <dd>{lookup.details.phone}</dd>
                </div>
              )}
              {lookup.details.website && (
                <div className="flex gap-2">
                  <Globe className="mt-0.5 h-4 w-4 shrink-0 text-stone-400" />
                  <dd className="truncate">{lookup.details.website}</dd>
                </div>
              )}
              {lookup.details.rating != null && (
                <div className="flex gap-2">
                  <Star className="mt-0.5 h-4 w-4 shrink-0 fill-amber-400 text-amber-400" />
                  <dd>
                    {lookup.details.rating} · {lookup.details.userRatingsTotal ?? 0} reviews
                  </dd>
                </div>
              )}
            </dl>
            {lookup.details.hours && (
              <p className="mt-3 whitespace-pre-line rounded-2xl bg-stone-50 p-3 text-xs text-stone-600">
                {lookup.details.hours}
              </p>
            )}
          </section>

          <section className="rounded-3xl border border-stone-200 bg-white p-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-stone-950">
              <Sparkles className="h-4 w-4 text-coral-600" />
              What the web says
            </h3>
            {lookup.research ? (
              <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-stone-700">
                {lookup.research}
              </p>
            ) : (
              <div className="mt-3">
                <p className="text-sm text-stone-500">
                  {lookup.researchFailed
                    ? "The search didn't come back in time."
                    : "Nothing found about them on the web."}
                </p>
                {lookup.researchFailed && (
                  <button
                    type="button"
                    onClick={() => void pick(lookup.details.placeId, true)}
                    disabled={retrying}
                    className="mt-2 inline-flex items-center gap-2 rounded-full border border-stone-200 px-3 py-1.5 text-xs font-semibold text-stone-700 transition hover:bg-stone-50 disabled:opacity-50"
                  >
                    {retrying && <Loader2 className="h-3 w-3 animate-spin" />}
                    Search again
                  </button>
                )}
                <p className="mt-2 text-xs text-stone-400">
                  Creating still works — the profile is built from the Maps listing
                  either way.
                </p>
              </div>
            )}
          </section>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => void create(!!lookup.duplicate)}
              disabled={creating || !canCreate}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-stone-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-stone-800 disabled:opacity-50"
            >
              {creating && <Loader2 className="h-4 w-4 animate-spin" />}
              {lookup.duplicate ? "Create anyway" : "Create their profile"}
            </button>
            <button
              type="button"
              onClick={() => {
                setLookup(null);
                setError(null);
              }}
              className="rounded-full border border-stone-200 px-4 py-3 text-sm font-semibold text-stone-700 transition hover:bg-stone-50"
            >
              Back
            </button>
          </div>
          {!canCreate && (
            <p className="text-center text-xs text-stone-500">
              Creating needs an admin account.
            </p>
          )}
        </div>
      )}

      {/* ── Created ────────────────────────────────────────────────────── */}
      {created && (
        <div className="mt-5 rounded-3xl border border-stone-200 bg-white p-6 text-center">
          <span className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-emerald-50">
            <Check className="h-5 w-5 text-emerald-600" />
          </span>
          <h2 className="mt-3 text-lg font-semibold text-stone-950">{created.name} is on the map</h2>
          <p className="mt-1 text-sm text-stone-500">
            {created.storySaved
              ? "Unclaimed profile created, with their story written in."
              : "Unclaimed profile created from the Maps listing. The story didn't come back this time."}
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Link
              href={created.url}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-stone-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-stone-800"
            >
              Open their page
              <ArrowRight className="h-4 w-4" />
            </Link>
            <button
              type="button"
              onClick={() => {
                setCreated(null);
                setLookup(null);
                setCandidates(null);
                setQuery("");
              }}
              className="rounded-full border border-stone-200 px-4 py-2.5 text-sm font-semibold text-stone-700 transition hover:bg-stone-50"
            >
              Next spot
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
