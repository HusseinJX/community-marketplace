"use client";

// The back link on a detail page (profile / event / chat room). Points at the
// place you actually came from — the home tab you were browsing, or the business
// profile you opened the event from — instead of a fixed destination.
//
// Origins are recorded on the way out (see lib/home-tab.ts). `document.referrer`
// can't do this job: App Router client navigations don't update it, so after a
// <Link> click it still points at wherever you first entered the site.
//
// Renders the fallback label on the server and first client render so there's no
// hydration mismatch, then corrects after mount. The href is valid either way;
// only the word can change, and it changes before you'd read it.

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { homeTabTarget, lastHomeTab, lastOrigin } from "@/lib/home-tab";

export function BackToHome({
  /** Forces a destination, ignoring where you came from. */
  href,
  label,
  className,
}: {
  href?: string;
  label?: string;
  className?: string;
}) {
  const pathname = usePathname();
  const [target, setTarget] = useState(() => homeTabTarget("feed"));

  useEffect(() => {
    if (href) return;
    const origin = lastOrigin();
    // Ignore an origin pointing at the page we're already on. That happens on
    // the round trip — profile → event → back to profile — where the profile
    // recorded itself on the way out. Without this the link would loop.
    const usable = origin && origin.href.split("?")[0] !== pathname ? origin : null;
    setTarget(usable ?? homeTabTarget(lastHomeTab()));
  }, [href, pathname]);

  const finalHref = href ?? target.href;
  const finalLabel = label ?? target.label;

  return (
    <Link
      href={finalHref}
      className={
        className ??
        "inline-flex items-center gap-1.5 text-sm font-medium text-stone-600 transition hover:text-indigo-700"
      }
    >
      <ArrowLeft className="size-4 shrink-0" />
      {finalLabel}
    </Link>
  );
}
