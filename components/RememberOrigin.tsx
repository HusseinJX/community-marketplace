"use client";

// Marks this page as "the place to come back to" for whatever you open from it.
// Drop it on any page that links onward to a detail view — a business profile
// links to its events, so an event opened from there should come back here
// rather than to a home tab.
//
// Renders nothing. BackToHome ignores an origin that points at the page it's
// currently on, so a page recording itself can't create a link to itself.

import { useEffect } from "react";
import { rememberOrigin } from "@/lib/home-tab";

export function RememberOrigin({ href, label }: { href: string; label: string }) {
  useEffect(() => {
    rememberOrigin({ href, label });
  }, [href, label]);
  return null;
}
