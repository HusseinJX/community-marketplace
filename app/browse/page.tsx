"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { LayoutGrid, Map as MapIcon, Heart, Apple, DollarSign, CreditCard, X, CalendarDays, Store } from "lucide-react";
import { listMembers, searchMembers } from "@/lib/api";
import type { Member, SearchResultMember, SearchIntent } from "@/lib/types";
import { MemberCard, MemberCardSkeleton } from "@/components/MemberCard";
import { MerchCard } from "@/components/feed/MerchCard";
import { EventsCard } from "@/components/feed/EventsCard";
import { FilterBar, type FilterType } from "@/components/FilterBar";
import { MapView } from "@/components/MapView";
import { SearchBar, type SearchMode } from "@/components/SearchBar";
import { QrScanButton } from "@/components/QrScanButton";
import { LiveNowRail } from "@/components/live/LiveNowRail";
import { HappeningThisWeek } from "@/components/feed/HappeningThisWeek";
import { LocationPicker, type PlaceOption } from "@/components/LocationPicker";
import { useLocation, placeIsSet, placeLabel } from "@/lib/location";
import { FilterSidebar } from "@/components/FilterSidebar";
import { matchesFacets } from "@/lib/business-facets";
import { DEMO_MEMBERS } from "@/lib/demo-members";
import { MEMBER_HERO_IMAGES } from "@/lib/member-images";
import { usableImages, isPlaceholder } from "@/lib/image-utils";

function memberHasImage(m: Member): boolean {
  if (MEMBER_HERO_IMAGES[m.id]?.length) return true;
  const p = m.profile;
  if (!p) return false;
  if (Array.isArray(p.images) && usableImages(p.images).length > 0) return true;
  if (p.imageUrl && !isPlaceholder(p.imageUrl)) return true;
  return false;
}

type ViewMode = "grid" | "map";

// Module-level cache survives across re-mounts (e.g. when navigating back to /).
// Keyed by JSON of filter params.
const memberCache = new Map<string, Member[]>();
const PAGE_SIZE = 40;

function lastActiveMs(m: Member): number {
  const t = m.lastActiveAt;
  if (!t) return 0;
  if (typeof t === "string") return Date.parse(t) || 0;
  if (typeof t === "object" && "_seconds" in t) return t._seconds * 1000;
  return 0;
}

export default function BrowsePage() {
  const [type, setType] = useState<FilterType>("all");
  const [city, setCity] = useState("");
  const [category, setCategory] = useState("");
  const [subcategory, setSubcategory] = useState("");
  const [view, setView] = useState<ViewMode>("grid");
  // Business-facet filters (size + ownership), surfaced via the search-bar button.
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [facetSize, setFacetSize] = useState("");
  const [facetOwnership, setFacetOwnership] = useState<string[]>([]);
  const toggleFacetOwnership = (k: string) =>
    setFacetOwnership((o) => (o.includes(k) ? o.filter((x) => x !== k) : [...o, k]));
  const facetCount = (facetSize ? 1 : 0) + facetOwnership.length;
  const cacheKey = JSON.stringify({ type, city, category, subcategory });
  const cached = memberCache.get(cacheKey);
  const [members, setMembers] = useState<Member[]>(cached ?? []);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState<string | null>(null);
  const [donateOpen, setDonateOpen] = useState(false);

  // The place lens (city + neighborhood) is the app's primary scope. It drives
  // the directory's city filter; neighborhood narrows client-side below.
  const { place, setPlace } = useLocation();
  useEffect(() => {
    setCity(place.city);
  }, [place.city]);

  // Infinite-scroll pagination state
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Search mode — "normal" (client-side keyword filter) is the default; "ai"
  // hits the smart-search endpoint and shows matchedOn chips.
  const [searchMode, setSearchMode] = useState<SearchMode>("normal");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResultMember[] | null>(null);
  const [searchIntent, setSearchIntent] = useState<SearchIntent | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);

  const runSearch = (q: string) => {
    setSearchQuery(q);
    if (searchMode === "normal") return; // normal mode is purely client-side
    setSearchLoading(true);
    setError(null);
    searchMembers(q, { limit: 60 })
      .then((r) => {
        setSearchResults(r.results);
        setSearchIntent(r.intent);
      })
      .catch((err) => setError(err.message || "Search failed."))
      .finally(() => setSearchLoading(false));
  };
  const clearSearch = () => {
    setSearchQuery("");
    setSearchResults(null);
    setSearchIntent(null);
  };
  const handleModeChange = (m: SearchMode) => {
    setSearchMode(m);
    // Clear remote AI results when switching back to normal; clear normal text
    // when switching to AI so the user gets a fresh prompt.
    setSearchQuery("");
    setSearchResults(null);
    setSearchIntent(null);
  };

  // Initial load (or filter change) — fetch the first page.
  useEffect(() => {
    let cancelled = false;
    const hit = memberCache.get(cacheKey);
    if (hit) {
      setMembers(hit);
      setLoading(false);
      setHasMore(hit.length >= PAGE_SIZE);
    } else {
      // Keep the stale member list visible during the fetch instead of
      // wiping it — wiping unmounts the Leaflet map and re-instantiates it,
      // which is jarring (full re-render flash). Just show the loading flag.
      setLoading(true);
      setHasMore(true);
    }
    setError(null);
    listMembers({
      type,
      city: city || undefined,
      category: category || undefined,
      subcategory: subcategory || undefined,
      limit: PAGE_SIZE,
    })
      .then((res) => {
        if (cancelled) return;
        memberCache.set(cacheKey, res.members);
        setMembers(res.members);
        setHasMore(res.members.length >= PAGE_SIZE);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Failed to load members.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [type, city, category, subcategory, cacheKey]);

  // Fetch next page — appends to existing members.
  const fetchMore = useCallback(async () => {
    if (loadingMore || !hasMore || searchQuery) return;
    setLoadingMore(true);
    try {
      const oldestMs = members.reduce<number>((min, m) => {
        const t = lastActiveMs(m);
        return t && (min === 0 || t < min) ? t : min;
      }, 0);
      const res = await listMembers({
        type,
        city: city || undefined,
        category: category || undefined,
        subcategory: subcategory || undefined,
        limit: PAGE_SIZE,
        cursor: oldestMs ? String(oldestMs) : undefined,
      });
      const seen = new Set(members.map((m) => m.id));
      const fresh = res.members.filter((m) => !seen.has(m.id));
      const next = [...members, ...fresh];
      memberCache.set(cacheKey, next);
      setMembers(next);
      setHasMore(fresh.length >= PAGE_SIZE);
    } catch (err) {
      setError((err as Error).message || "Failed to load more.");
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, searchQuery, members, type, city, category, subcategory, cacheKey]);

  // Wire up an IntersectionObserver on the sentinel below the grid.
  // Disable infinite scroll only when AI search is active (remote results
  // replace the feed). Normal-mode keyword filter still lets the grid grow.
  const aiSearchActive = searchMode === "ai" && !!searchQuery;
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasMore || aiSearchActive) return;
    const obs = new IntersectionObserver(
      (entries) => { if (entries[0]?.isIntersecting) fetchMore(); },
      { rootMargin: "400px 0px" }, // pre-fetch before user reaches the bottom
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, [hasMore, aiSearchActive, fetchMore]);

  const visible = useMemo(() => {
    const real = members.filter((m) => m.profile?.name);
    const demos = DEMO_MEMBERS.filter((m) => type === "all" || m.profile?.memberType === type);
    let all = [...real, ...demos];

    // Normal-mode keyword filter — substring match across name, category,
    // descriptions, neighborhood, and a few tag-like arrays.
    if (searchMode === "normal" && searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      all = all.filter((m) => {
        const p = m.profile ?? {};
        const haystack: string[] = [];
        const push = (v: unknown) => {
          if (typeof v === "string") haystack.push(v);
          else if (Array.isArray(v)) for (const x of v) if (typeof x === "string") haystack.push(x);
        };
        push(p.name);
        push(p.businessName);
        push(p.category);
        push(p.subcategory);
        push(p.city);
        push(p.neighborhood);
        push(p.approvedBlurb);
        push(p.businessDescription);
        push(p.personalNote);
        push(p.description);
        push(p.services);
        push(p.specialties);
        push(p.menuHighlights);
        push(p.interests);
        push(p.shareTypes);
        return haystack.some((s) => s.toLowerCase().includes(q));
      });
    }

    // Business-facet filters (size + ownership) — client-side over loaded members.
    if (facetSize || facetOwnership.length) {
      all = all.filter((m) => matchesFacets(m.profile, { size: facetSize, ownership: facetOwnership }));
    }

    // Neighborhood lens — narrow to the selected neighborhood. Members with no
    // neighborhood set still show so sparse data doesn't empty the grid.
    if (place.neighborhood) {
      const pn = place.neighborhood.trim().toLowerCase();
      all = all.filter((m) => {
        const n = (m.profile?.neighborhood || "").trim().toLowerCase();
        return !n || n === pn;
      });
    }

    // Stable partition: members with images first, then without. Keeps the
    // existing rank within each group (no reshuffling beyond that).
    const withImg: Member[] = [], withoutImg: Member[] = [];
    for (const m of all) (memberHasImage(m) ? withImg : withoutImg).push(m);
    return [...withImg, ...withoutImg];
  }, [members, type, searchMode, searchQuery, facetSize, facetOwnership, place.neighborhood]);

  // Places (city → neighborhoods) for the location picker, derived from members.
  const places: PlaceOption[] = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const m of members) {
      const c = (m.profile?.city || "").trim();
      if (!c) continue;
      if (!map.has(c)) map.set(c, new Set());
      const n = (m.profile?.neighborhood || "").trim();
      if (n) map.get(c)!.add(n);
    }
    return [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([city, hoods]) => ({ city, neighborhoods: [...hoods].sort() }));
  }, [members]);

  return (
    <div className="mx-auto max-w-7xl px-4 pb-20 md:px-8">
      {/* Gradient hero */}
      <section className="relative -mx-4 mb-6 overflow-hidden rounded-b-[2.5rem] md:-mx-8 md:mt-6 md:rounded-[2.5rem]">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 via-sky-50 to-violet-50" />
        <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-teal-300/40 blur-3xl" />
        <div className="absolute right-[-6rem] top-10 h-80 w-80 rounded-full bg-sky-300/40 blur-3xl" />
        <div className="absolute bottom-[-6rem] left-1/3 h-72 w-72 rounded-full bg-violet-300/40 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.06] [background-image:radial-gradient(circle_at_1px_1px,#0f172a_1px,transparent_0)] [background-size:22px_22px]" />
        <div className="relative py-16 md:py-24">
          <div className="mx-auto max-w-3xl px-6 text-center">
            <h1 className="text-5xl font-semibold leading-[1.05] tracking-tight text-stone-900 md:text-7xl">
              What&apos;s{" "}
              <span className="bg-gradient-to-r from-teal-600 via-sky-600 to-violet-600 bg-clip-text text-transparent">
                Local
              </span>
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-base text-stone-600 md:text-lg">
              Local events, makers, and businesses near you — discover what&apos;s happening this week, or bring people together for your own.
            </p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-2">
              <Link
                href="/events?view=events"
                className="inline-flex items-center gap-2 rounded-full bg-stone-900 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-stone-800 hover:shadow-md hover:-translate-y-0.5"
              >
                <CalendarDays className="h-4 w-4" /> See what&apos;s happening
              </Link>
              <Link
                href="/vendor"
                className="inline-flex items-center gap-2 rounded-full bg-white/90 px-5 py-2.5 text-sm font-medium text-stone-800 ring-1 ring-stone-200 shadow-sm backdrop-blur transition-all hover:ring-stone-300 hover:shadow-md hover:-translate-y-0.5"
              >
                <Store className="h-4 w-4" /> List your business
              </Link>
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

      {/* Place lens — the app's primary geographic scope */}
      <section className="mb-3 flex flex-wrap items-center gap-2">
        <LocationPicker places={places} />
        <span className="text-sm text-stone-500">
          {placeIsSet(place) ? `Showing what's near ${placeLabel(place)}` : "Pick your area to scope events & businesses"}
        </span>
      </section>

      {/* Smart search bar + QR scanner */}
      <section className="mb-3 flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <SearchBar
            value={searchQuery}
            mode={searchMode}
            onModeChange={handleModeChange}
            onSubmit={runSearch}
            onChange={setSearchQuery}
            onClear={clearSearch}
            onOpenFilters={() => setFiltersOpen(true)}
            activeFilters={facetCount}
            loading={searchLoading}
          />
        </div>
        <QrScanButton />
      </section>

      {/* Live now near you — hidden when nothing is live */}
      <LiveNowRail />

      {/* Happening this week — local events front-and-center (the core loop).
          Hidden while searching so search results own the view. */}
      {!searchQuery && <HappeningThisWeek />}

      <FilterSidebar
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        size={facetSize}
        ownership={facetOwnership}
        onSizeChange={setFacetSize}
        onToggleOwnership={toggleFacetOwnership}
        onClear={() => { setFacetSize(""); setFacetOwnership([]); }}
      />

      {/* Filters + view toggle — hidden while AI search is active */}
      {!aiSearchActive && !searchQuery && (
        <div className="mb-3 mt-2">
          <h2 className="text-xl font-semibold tracking-tight text-stone-900">Local directory</h2>
          <p className="text-sm text-stone-500">Browse makers, vendors, artists, and community orgs near you.</p>
        </div>
      )}

      {!aiSearchActive && (
        <section className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <FilterBar
              type={type}
              city={city}
              category={category}
              subcategory={subcategory}
              onTypeChange={(t) => { setType(t); setCategory(""); setSubcategory(""); }}
              onCityChange={(c) => { setCity(c); setPlace({ city: c, neighborhood: "" }); }}
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
      )}

      {/* Intent summary while AI search is active */}
      {aiSearchActive && searchIntent && (
        <section className="mb-2 rounded-2xl border border-stone-200 bg-white/70 px-4 py-3 text-xs text-stone-600">
          <span className="font-medium text-stone-800">{searchResults?.length ?? 0} results</span>
          {searchIntent.filters && Object.keys(searchIntent.filters).length > 0 && (
            <span className="ml-2">
              filtered by{" "}
              <span className="font-mono text-stone-700">
                {Object.entries(searchIntent.filters).map(([k, v]) =>
                  Array.isArray(v) ? `${k}:[${v.join(",")}]` : `${k}:${v}`
                ).join(" · ")}
              </span>
            </span>
          )}
        </section>
      )}

      {/* Results */}
      <section className="mt-8">
        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {error}
          </div>
        )}

        {/* AI search mode — show remote search results with matchedOn chips */}
        {aiSearchActive ? (
          searchLoading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => <MemberCardSkeleton key={i} />)}
            </div>
          ) : (searchResults && searchResults.length > 0) ? (
            <div className="grid auto-rows-fr grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {searchResults.map((m) => (
                <MemberCard key={m.id} member={m} matchedOn={m.matchedOn} />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-stone-300 bg-white/60 p-12 text-center">
              <p className="text-base font-medium text-stone-800">No results for “{searchQuery}”.</p>
              <p className="mt-1 text-sm text-stone-500">
                Try simpler phrasing, drop the neighborhood, or clear the search to browse.
              </p>
            </div>
          )
        ) : (
          <>
            {view === "map" && (
              <div className="relative">
                <MapView members={visible} />
                {visible.length === 0 && !loading && (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div className="rounded-2xl bg-white/90 px-5 py-3 text-sm text-stone-700 shadow-md ring-1 ring-stone-200">
                      No members match your filters.
                    </div>
                  </div>
                )}
              </div>
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
              <>
                <div className="grid auto-rows-fr grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {visible.map((m, i) => (
                    <Fragment key={m.id}>
                      <MemberCard member={m} />
                      {/* Official WhatsLocal merch — featured after the 3rd card */}
                      {i === 2 && <MerchCard />}
                      {/* Atlas — official WhatsLocal events — featured after the 6th card */}
                      {i === 5 && <EventsCard />}
                    </Fragment>
                  ))}
                </div>

                {/* Sentinel + bottom-of-list states */}
                {hasMore && (
                  <div ref={sentinelRef} className="mt-6 h-px w-full" aria-hidden />
                )}
                {loadingMore && (
                  <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <MemberCardSkeleton key={`more-${i}`} />
                    ))}
                  </div>
                )}
                {!hasMore && !loadingMore && (
                  <div className="mt-10 text-center text-xs text-stone-500">
                    You've reached the end of the directory.
                  </div>
                )}
              </>
            )}
          </>
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
