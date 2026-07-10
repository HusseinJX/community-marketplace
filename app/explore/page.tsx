"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Search } from "lucide-react";
import type { Member } from "@/lib/types";
import { MEMBER_HERO_IMAGES } from "@/lib/member-images";
import { usableImages, isPlaceholder } from "@/lib/image-utils";
import { BUSINESS_SIZES, OWNERSHIP_TAGS, matchesFacets } from "@/lib/business-facets";
import { useDirectory } from "@/lib/data-hooks";

function firstImage(m: Member): string | null {
  const curated = MEMBER_HERO_IMAGES[m.id];
  if (curated?.length) return curated[0];
  const p = m.profile;
  if (p) {
    const imgs = Array.isArray(p.images) ? usableImages(p.images) : [];
    if (imgs.length) return imgs[0];
    if (p.imageUrl && !isPlaceholder(p.imageUrl)) return p.imageUrl;
  }
  return null;
}

// Instagram-style Explore: a full-bleed grid of square image tiles.
export default function ExplorePage() {
  // Shared, server-cached directory (same key as the home "Who's local" rail).
  const { members } = useDirectory();
  const [q, setQ] = useState("");
  const [size, setSize] = useState("");
  const [own, setOwn] = useState<string[]>([]);
  const toggleOwn = (k: string) => setOwn((o) => (o.includes(k) ? o.filter((x) => x !== k) : [...o, k]));

  // Real search: the cached directory is only the first browse page, so typing a
  // name filters too small a set. When there's a query we hit the connector's
  // server-side index via /api/directory?search= (covers all members).
  const term = q.trim();
  const searching = term.length >= 2;
  const [results, setResults] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!searching) {
      setResults([]);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/directory?search=${encodeURIComponent(term)}`, {
          signal: ctrl.signal,
        });
        const data = res.ok ? await res.json() : { members: [] };
        setResults(Array.isArray(data.members) ? data.members : []);
      } catch {
        /* aborted or failed — leave prior results */
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      ctrl.abort();
      clearTimeout(t);
    };
  }, [term, searching]);

  const tiles = useMemo(() => {
    // Browse mode: cached directory, image tiles only. Search mode: server
    // results, and keep members even without a photo (fallback tile) so a real
    // match is never silently dropped for lacking a hero image.
    const source = searching ? results : members;
    return source
      .map((m) => ({ m, img: firstImage(m) }))
      .filter((t) => searching || t.img)
      .filter((t) => matchesFacets(t.m.profile, { size, ownership: own }));
  }, [members, results, searching, size, own]);

  return (
    <div className="pb-6">
      {/* Search */}
      <div className="px-3 py-3">
        <div className="relative flex items-center">
          <Search className="pointer-events-none absolute left-3 h-4 w-4 text-stone-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search local"
            className="w-full rounded-xl border border-stone-200 bg-stone-100 py-2 pl-9 pr-3 text-base text-stone-900 placeholder-stone-400 focus:border-stone-300 focus:bg-white focus:outline-none"
          />
        </div>
        {/* Facet filters: business size + ownership/type — single horizontal scroll row */}
        <div className="-mx-3 mt-2 flex items-center gap-1.5 overflow-x-auto px-3 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <select
            value={size}
            onChange={(e) => setSize(e.target.value)}
            className="shrink-0 rounded-full border border-stone-200 bg-white px-3 py-1 text-xs text-stone-600"
          >
            <option value="">Any size</option>
            {BUSINESS_SIZES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
          {OWNERSHIP_TAGS.map((o) => (
            <button
              key={o.key}
              onClick={() => toggleOwn(o.key)}
              className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium ${own.includes(o.key) ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200"}`}
            >
              {o.label}
            </button>
          ))}
          {(size || own.length > 0) && (
            <button onClick={() => { setSize(""); setOwn([]); }} className="shrink-0 whitespace-nowrap text-xs text-stone-400 underline hover:text-stone-600">
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Square grid */}
      <div className="grid grid-cols-3 gap-0.5">
        {tiles.map(({ m, img }) => (
          <Link
            key={m.id}
            href={`/members/${m.id}`}
            className="relative block aspect-square overflow-hidden bg-stone-100"
          >
            {img ? (
              <Image
                src={img}
                alt={m.profile?.name || "Local business"}
                fill
                sizes="33vw"
                className="object-cover transition duration-200 hover:opacity-90"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-stone-200 to-stone-300 p-2 text-center text-xs font-medium text-stone-600 transition duration-200 hover:opacity-90">
                {m.profile?.name || "Local business"}
              </div>
            )}
          </Link>
        ))}
      </div>

      {tiles.length === 0 && (
        <p className="px-4 py-16 text-center text-sm text-stone-400">
          {searching ? (loading ? "Searching…" : "No results.") : "No results."}
        </p>
      )}
    </div>
  );
}
