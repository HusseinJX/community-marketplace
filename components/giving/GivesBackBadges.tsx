"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Heart } from "lucide-react";
import { KIND_LABEL, type Contribution } from "@/lib/contributions";

// "Gives back" — a member's org-confirmed community gifts, shown publicly so
// shoppers see who supports their community. Renders nothing until confirmed
// gifts exist, so it's safe to drop on every profile.
export function GivesBackBadges({ memberId }: { memberId: string; memberName?: string }) {
  const [items, setItems] = useState<Contribution[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/contributions/${memberId}`)
      .then((r) => (r.ok ? r.json() : { contributions: [] }))
      .then((d) => {
        if (!cancelled) setItems(Array.isArray(d.contributions) ? d.contributions : []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [memberId]);

  if (items.length === 0) return null;

  return (
    <section className="rounded-2xl border border-rose-100 bg-rose-50/50 p-5">
      <p className="section-label mb-3 flex items-center gap-1.5 text-rose-700">
        <Heart className="h-3.5 w-3.5 fill-rose-500 text-rose-500" /> Gives back
      </p>
      <ul className="space-y-2.5">
        {items.map((c) => (
          <li key={c.id} className="flex items-start gap-2.5 text-sm">
            <span className="mt-0.5 rounded-full bg-white px-2 py-0.5 text-xs font-medium text-rose-600 ring-1 ring-rose-100">
              {KIND_LABEL[c.kind]}
            </span>
            <span className="text-stone-700">
              {c.description}
              {c.org_id && c.org_name && (
                <>
                  {" — "}
                  <Link href={`/members/${c.org_id}`} className="font-medium text-rose-700 hover:underline">
                    {c.org_name}
                  </Link>
                </>
              )}
              <span className="ml-1 text-xs text-stone-400">· confirmed</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
