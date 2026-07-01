"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

// Prominent top-of-home search. Sits right below the "Live & local" hero and
// routes into the full browse/search experience (which reads ?q= on load).
export function HomeSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const term = q.trim();
    router.push(term ? `/browse?q=${encodeURIComponent(term)}` : "/browse");
  };

  return (
    <div className="mx-auto max-w-6xl px-4 md:px-8">
      <form onSubmit={submit} className="mb-8">
        <div className="relative flex items-center">
          <Search className="pointer-events-none absolute left-4 h-5 w-5 text-stone-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search local businesses, makers, events & people…"
            aria-label="Search local"
            className="w-full rounded-full border border-stone-200 bg-white py-3.5 pl-12 pr-4 text-base shadow-sm transition placeholder-stone-400 focus:border-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-300"
          />
        </div>
      </form>
    </div>
  );
}
