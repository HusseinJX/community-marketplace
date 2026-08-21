"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search } from "lucide-react";
import { AccountMenu } from "@/components/AccountMenu";
import { HeaderMenu } from "@/components/HeaderMenu";
import { CityHeader } from "@/components/home/CityHeader";
import { useHomeHeader, expandHeader } from "@/lib/home-header";

/**
 * The global top bar: brand left, account capsule right.
 *
 * ── What changed and why ────────────────────────────────────────────────────
 * It was three equal columns — "+" · centred wordmark · theme toggle — and in
 * production the right column was empty, because the theme toggle is dev-only.
 * So the shipped header was a centred wordmark with a third of the bar blank
 * beside it, while /favorites, /tickets, /messages and /cart had no way in.
 *
 * Now: the wordmark takes the left, where a logo goes on every marketplace
 * people already use, and the right holds the account capsule that carries
 * everything the "+" used to (posting moved inside it, still vendor-gated).
 * Nothing is centred, so nothing shifts when a control appears or disappears —
 * the problem the three-column grid existed to solve is gone rather than
 * worked around.
 *
 * Kept deliberately thin: on the home page a second sticky band underneath
 * carries the tab switcher, the search and the category rail (HomeTabs). This
 * bar is the part that is identical on every screen.
 */
// The shopper's own screens — everything the bottom nav leads to. The city
// rides in the nav here too, so walking from the feed to your cart doesn't
// silently drop the one line saying which city all of this is.
//
// PASSIVE on these pages (see CityHeader's `passive`): none of them sorts by
// distance, so the name is shown only if home already learned it. No page in
// this list may raise a location prompt.
const CITY_PATHS = ["/shopper", "/cart", "/tickets", "/favorites"];

export function TopNav() {
  const { active, collapsed, label } = useHomeHeader();
  const pathname = usePathname();
  // Only on home, and only once the header has actually collapsed.
  const showCompactSearch = active && collapsed;
  // Sub-routes count: /shopper/personalization is still your space.
  const cityPage =
    !active && CITY_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  return (
    // Two padding states, and the TOTAL HEIGHT is the same in both — 80px,
    // which is what `--top-nav` in globals.css promises every sticky element
    // below. Animating the height instead would drag the search band, the day
    // headings and the profile sidebar around with it.
    //
    // Expanded: 32 / 36 / 12 — generous above, tight beneath, matching the
    // search band's asymmetry so the brand sits in air rather than clamped
    // against the top of the screen.
    //
    // Collapsed: 22 / 36 / 22 — even. Once the row is the whole header there
    // is nothing beneath it for the weight to lean toward, and the title sat
    // visibly nearer its own bottom edge than the top of the screen.
    <div
      className="wl-hdr-row relative flex items-center justify-between gap-3 px-4 md:px-8"
    >
      <Link
        href="/"
        className="inline-flex min-w-0 shrink-0 items-center gap-2 text-stone-900"
        aria-label="WhatsLocal AI — home"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="" className="h-9 w-9 shrink-0" />
        <span className="truncate text-[17px] font-semibold tracking-tight">WhatsLocal AI</span>
      </Link>

      {/* City, on the title row.
          Desktop: immediately after the wordmark, reading as one line —
          "WhatsLocal AI · San Francisco". Mobile: pushed right, because the
          toggle row below has no width to spare and the right of this row is
          empty there anyway (the avatar and the vendor link are desktop-only).

          Hidden once the header collapses: the compact search pill is centred
          across this row and would sit on top of it.

          On home it is live — it asks for a fix and carries the city switcher,
          because everything below it sorts by distance. On the shopper's own
          screens (CITY_PATHS) it is passive: same line, same switcher, but it
          only ever repeats a city home already established. That distinction is
          the whole reason this can render off home at all — the old comment
          here was right that a nav-wide city would otherwise mean a location
          prompt on pages with no use for one. */}
      {(active || cityPage) && (
        <div
          className={
            "wl-hdr-city ml-auto flex min-w-0 items-center md:ml-3 md:mr-auto " +
            (showCompactSearch ? "pointer-events-none" : "")
          }
          aria-hidden={showCompactSearch}
        >
          <CityHeader variant="nav" passive={!active} />
        </div>
      )}

      {/* The collapsed search. Rides in the wordmark row once the full one has
          scrolled away, so search is never more than one tap from anywhere in
          a long list. Tapping it expands the whole header again — city, tabs
          and the full input — WITHOUT scrolling the page, so you don't lose
          your place to reach the search box. */}
      {active && (
        // Centred on the SCREEN, not between its neighbours. As a flex child
        // it sat between a ~200px wordmark and a ~66px menu, so "the middle"
        // was 30px left of the actual centre — and it visibly wasn't lined up
        // with the search it grows out of, which is centred in the page
        // container below. Taken out of the flow, both agree.
        // pointer-events-none on the layer so the empty half of the row
        // doesn't swallow clicks meant for the header behind it.
        //
        // inset-y-0 rather than matching the row's padding: the pill is only
        // ever visible in the collapsed state, whose padding is symmetric, so
        // centring in the full padded box IS centring on the row.
        <div className="pointer-events-none absolute inset-x-0 inset-y-0 flex items-center justify-center px-4 md:px-8">
          <button
            onClick={expandHeader}
            tabIndex={showCompactSearch ? 0 : -1}
            aria-hidden={!showCompactSearch}
            className={
              // ALWAYS mounted while on home, and animated between states
              // rather than swapped in and out. Mounting it on collapse made
              // the search flip: the big one vanished and a different element
              // blinked into the row, with nothing connecting them. Kept in
              // the tree, it can rise and settle as the big one folds up, and
              // the two read as one control changing size.
              // Opacity and transform are the .wl-hdr-pill rule — it rises,
              // grows and fades as a function of the scroll position, on the
              // fold's back half, so it reads as the full search resizing
              // rather than as a different element blinking into the row.
              // Only the shadow is a hover transition; only pointer-events
              // are React's business.
              "wl-hdr-pill flex w-full max-w-lg items-center gap-2.5 rounded-full border border-stone-200 bg-white py-2.5 pl-4 pr-1.5 text-left shadow-[var(--shadow-soft)] " +
              "transition-[box-shadow] duration-200 hover:shadow-[var(--shadow-lift)] " +
              (showCompactSearch ? "pointer-events-auto" : "pointer-events-none")
            }
          >
            <Search className="h-4 w-4 shrink-0 text-stone-500" />
            <span className={"min-w-0 flex-1 truncate t-meta " + (label ? "text-stone-900" : "text-stone-400")}>
              {label || "Search"}
            </span>
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-coral-600 text-white">
              <Search className="h-3.5 w-3.5" />
            </span>
          </button>
        </div>
      )}

      <div className="flex shrink-0 items-center gap-1">
        {/* The supply-side door, desktop only.
            A ghost button: bare text at rest, and the pill only draws itself
            under the cursor. Every marketplace header has one of these and it
            is always the quietest thing in the row — it is an ask, and an ask
            rendered as a solid button competes with the reader's own actions
            for the same attention. Hidden on a phone, where the row has no
            spare width and the same link already sits under the tab heading. */}
        <Link
          href="/join"
          className="hidden rounded-full px-3.5 py-2 t-meta font-semibold text-stone-700 transition-colors duration-200 hover:bg-stone-200/70 hover:text-stone-900 md:inline-flex"
        >
          Join as a vendor
        </Link>

        {/* The theme toggle is gone from the header entirely — it used to be
            dev-only, which meant the bar looked different here than it does
            for anyone using the app, and every judgement about the nav was
            being made against a layout that never ships. Light is the only
            public theme; the dark stylesheet in globals.css stays for when
            that changes. */}
        <HeaderMenu />
        <AccountMenu />
      </div>
    </div>
  );
}
