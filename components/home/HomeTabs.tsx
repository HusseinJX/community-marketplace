"use client";

import Link from "next/link";
import { Store, ArrowRight } from "lucide-react";
import { WhatsOn } from "@/components/home/WhatsOn";
import { HomeSearch } from "@/components/home/HomeSearch";

// The shopper front door — ONE surface.
//
// It used to be three tabs: Feed (everyone's posts), Events, Shop (the
// directory). Both of the other two are gone from here, deliberately:
//
//  · The posts feed was a reverse-chronological Instagram clone that would be
//    EMPTY — and an empty social feed on the home screen tells a first-time
//    visitor the app is dead. Posts still exist and still matter, but attached
//    to something real: the "memories" walls on event pages, business profiles,
//    and live broadcasts, where the same photo reads as PROOF the collaboration
//    happened instead of "nobody is here". Composing still lives on the "+" in
//    the top nav.
//
//  · The directory was the pitch we can't win (Google/Instagram own it). Its
//    value is SEO — /members/[id], /category, /city — which crawlers and links
//    reach directly; nobody needs a home tab for it. The search bar above covers
//    "find me a specific business", and a quiet link at the bottom of What's on
//    covers "show me everyone".
//
// What's left is the hook, which is the OUTPUT of the collaborations the app is
// actually about: what's happening near you.
export function HomeTabs() {
  return (
    <>
      <div className="mx-auto max-w-6xl px-4 pt-4 md:px-8">
        <HomeSearch />

        {/* The one line for supply: this is a shopper door, but the wedge is
            businesses teaming up, and a cold visitor who owns a bakery would
            otherwise have to dig it out of the footer. */}
        <Link
          href="/businesses"
          className="mt-3 flex items-center gap-2 text-[13px] text-stone-500 transition hover:text-stone-900"
        >
          <Store className="h-3.5 w-3.5 shrink-0 text-stone-400" />
          <span className="min-w-0 truncate">
            <span className="font-medium text-stone-700">Own a local business?</span> See who to team up
            with.
          </span>
          <ArrowRight className="h-3.5 w-3.5 shrink-0" />
        </Link>
      </div>

      <div className="pb-24">
        <WhatsOn />

        {/* The floor, not the pitch. */}
        <div className="mx-auto mt-10 max-w-6xl px-4 md:px-8">
          <Link
            href="/explore"
            className="flex items-center justify-between gap-3 border-t border-stone-100 pt-5 text-[13px] font-medium text-stone-600 transition hover:text-stone-900"
          >
            Browse all local businesses
            <ArrowRight className="h-4 w-4 shrink-0 text-stone-400" />
          </Link>
        </div>
      </div>
    </>
  );
}
