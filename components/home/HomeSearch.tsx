"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { QrScanButton } from "@/components/QrScanButton";

// Top-of-home search. Two controls, both about finding a SPECIFIC thing:
// type a name, or scan a QR / tap an NFC tag at a market.
//
// The business-facet filter (size / ownership) used to live here too. It doesn't
// anymore: home is "what's on", not a directory, so a filter for business size
// had nothing to do with anything on the page — and the filter you actually want
// here (what KIND of thing is happening) is the chip row inside What's on. The
// facet filter now lives on /explore, which is the directory it filters.
export function HomeSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const term = q.trim();
    router.push(term ? `/explore?q=${encodeURIComponent(term)}` : "/explore");
  };

  return (
    <div className="mx-auto max-w-6xl px-4 md:px-8">
      <form onSubmit={submit}>
        <div className="flex items-center gap-2">
          <div className="relative flex flex-1 items-center">
            <Search className="pointer-events-none absolute left-3.5 h-5 w-5 text-stone-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search local businesses"
              aria-label="Search local businesses"
              className="w-full rounded-full border border-stone-200 bg-white py-3 pl-11 pr-4 text-base transition placeholder-stone-400 focus:border-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-200"
            />
          </div>
          <QrScanButton />
        </div>
      </form>
    </div>
  );
}
