"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Search } from "lucide-react";
import { listMembers } from "@/lib/api";
import type { Member } from "@/lib/types";
import { DEMO_MEMBERS } from "@/lib/demo-members";
import { MEMBER_HERO_IMAGES } from "@/lib/member-images";
import { usableImages, isPlaceholder } from "@/lib/image-utils";

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
  // Seed with demo members so the grid paints instantly; real data replaces it.
  const [members, setMembers] = useState<Member[]>(() => DEMO_MEMBERS);
  const [q, setQ] = useState("");

  useEffect(() => {
    let cancelled = false;
    listMembers({ limit: 90 })
      .then((r) => {
        if (!cancelled && r.members?.length) setMembers(r.members);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const tiles = useMemo(() => {
    const term = q.trim().toLowerCase();
    return members
      .map((m) => ({ m, img: firstImage(m) }))
      .filter((t) => t.img)
      .filter((t) =>
        term ? (t.m.profile?.name ?? "").toLowerCase().includes(term) : true
      );
  }, [members, q]);

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
      </div>

      {/* Square grid */}
      <div className="grid grid-cols-3 gap-0.5">
        {tiles.map(({ m, img }) => (
          <Link
            key={m.id}
            href={`/members/${m.id}`}
            className="relative block aspect-square overflow-hidden bg-stone-100"
          >
            <Image
              src={img as string}
              alt={m.profile?.name || "Local business"}
              fill
              sizes="33vw"
              className="object-cover transition duration-200 hover:opacity-90"
            />
          </Link>
        ))}
      </div>

      {tiles.length === 0 && (
        <p className="px-4 py-16 text-center text-sm text-stone-400">No results.</p>
      )}
    </div>
  );
}
