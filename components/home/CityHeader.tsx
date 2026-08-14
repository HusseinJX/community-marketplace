"use client";

// Which city you are being served, on every home tab.
//
// Two states, and the second is the point: someone opening this in Chicago
// should be told we aren't there yet rather than shown a San Francisco feed and
// left to work it out from the venue names. Saying so costs one line and turns
// a confusing empty-feeling app into a waitlist.
//
// Position comes from the shared home cache (lib/home-position), never a fresh
// getCurrentPosition() — this sits above a feed that also wants coordinates, and
// two callers would mean two permission dialogs.
//
// Which cities count as live is DERIVED from the sources that feed them
// (lib/cities.ts → lib/sources/registry.ts). It used to read a hand-typed
// `status: "live"` flag in prototype-data, which meant this header and the
// actual scraping pipeline could disagree — it could name a city with no events
// in it. Adding the first source for a city is now what turns it on.

import { useEffect, useRef, useState } from "react";
import { Check, Globe, LocateFixed } from "lucide-react";
import {
  useHomePosition,
  cityOverride,
  setCityOverride,
  refreshHomePosition,
} from "@/lib/home-position";
import { nearestCity, liveCities, isCityLive, cityById, CITIES, type City } from "@/lib/cities";
import { trackConversion } from "@/lib/analytics";

const FALLBACK: City | undefined = liveCities()[0];
const INTEREST_KEY = "wl_city_interest";

export function CityHeader({
  /**
   * `nav` — the compact name + globe that rides in the top bar beside the
   * wordmark. Where you are is app-wide context, so it belongs in the app-wide
   * chrome rather than as a page title that scrolls away.
   *
   * `page` — what is LEFT on the page once the name has moved up: only the
   * "we're not in your city yet" prompt, which is a paragraph and a button and
   * could never fit in a nav bar. Renders nothing when the city is served,
   * because the nav is already naming it.
   */
  variant = "page",
}: { variant?: "page" | "nav" } = {}) {
  const { position, settled } = useHomePosition();
  const pinnedId = cityOverride();
  const pinned = pinnedId ? cityById(pinnedId) : undefined;
  const [asked, setAsked] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      return window.localStorage.getItem(INTEREST_KEY);
    } catch {
      return null;
    }
  });

  // Nearest city we know of, and the nearest we actually cover. Before the
  // position settles — or after a refusal — we say nothing rather than claim a
  // city, because a wrong "Near you in …" is worse than no line at all.
  const near = position ? nearestCity(position.lat, position.lng)?.city ?? null : null;
  const live = position
    ? nearestCity(position.lat, position.lng, { liveOnly: true })?.city ?? null
    : null;

  const nav = variant === "nav";

  // A pinned city is a stated choice, so it answers the question outright —
  // no "we're not there yet" prompt, no waiting on the device.
  if (pinned) {
    return nav ? <CityTitle city={pinned} pinned nav /> : null;
  }

  // Say nothing until we actually know where they are.
  //
  // Falling back to the one live city looks harmless and is not: "Near you in
  // San Francisco" shown to someone in Chicago who denied location is a
  // confidently wrong statement, and the feed below already offers to turn
  // location on. A missing line beats a false one.
  //
  // The one exception is the switcher: someone who refused location still
  // needs a way IN, so once the attempt has settled with nothing we show the
  // globe on its own rather than an empty space.
  if (!settled) return null;
  if (!near) {
    return nav ? (
      <div className="flex min-w-0 items-center gap-1">
        <span className="truncate t-meta text-stone-400">Pick a city</span>
        <CityPicker current={null} />
      </div>
    ) : null;
  }

  // Live = this city has at least one source feeding it. Never a stored flag.
  const servedHere = isCityLive(near.id);
  const cover = live ?? FALLBACK;

  if (servedHere) {
    // Just the city. "Near you in San Francisco" spent most of a line
    // explaining a mechanic; the name alone says where you are, and the
    // surfaces below already say they're sorted by distance.
    return nav ? <CityTitle city={near} nav /> : null;
  }

  // Not served. This is the one thing that stays on the PAGE — it's a
  // paragraph and a button, and it could never live in a nav bar. In the nav
  // we name the nearest city we DO cover instead, so the switcher is still
  // reachable from up there.
  if (nav) {
    return cover ? <CityTitle city={cover} nav /> : (
      <div className="flex min-w-0 items-center gap-1">
        <span className="truncate t-meta text-stone-400">Pick a city</span>
        <CityPicker current={null} />
      </div>
    );
  }

  const done = asked === near.id;

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
      <p className="text-[13px] text-amber-900">
        We&apos;re not in <span className="font-semibold">{near.city}</span> yet
        {cover ? (
          <>
            {" "}
            — the nearest city we cover is{" "}
            <span className="font-semibold">{cover.city}</span>.
          </>
        ) : (
          "."
        )}
      </p>
      {done ? (
        <p className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-medium text-emerald-700">
          <Check className="h-3.5 w-3.5" />
          Thanks — we&apos;ll tell you when {near.city} goes live.
        </p>
      ) : (
        <button
          type="button"
          onClick={() => {
            // Recorded in PostHog, so the button is not a placebo: demand per
            // city is exactly the signal that decides where we open next.
            trackConversion("city_interest", { city: near.city, city_id: near.id });
            try {
              window.localStorage.setItem(INTEREST_KEY, near.id);
            } catch {
              /* private mode — it just asks again next visit */
            }
            setAsked(near.id);
          }}
          className="mt-2 rounded-full bg-stone-900 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-stone-800"
        >
          Bring WhatsLocal to {near.city}
        </button>
      )}
    </div>
  );
}

/** The city name with the switcher beside it. */
function CityTitle({
  city,
  pinned = false,
  nav = false,
}: {
  city: City;
  pinned?: boolean;
  nav?: boolean;
}) {
  if (nav) {
    return (
      // Sits on the toggle row now, not beside the wordmark, so it no longer
      // needs a divider to separate it from the brand.
      <div className="flex min-w-0 items-center gap-0.5">
        <span className="truncate t-lead font-semibold text-stone-900">{city.city}</span>
        <CityPicker current={city.id} pinned={pinned} nav />
      </div>
    );
  }

  return (
    <div className="flex min-w-0 items-center gap-2">
      <h1 className="truncate text-2xl font-semibold tracking-tight text-stone-900">
        {city.city}
      </h1>
      <CityPicker current={city.id} pinned={pinned} />
    </div>
  );
}

/**
 * Switch which city you're browsing.
 *
 * Writes to the shared position layer (lib/home-position), NOT to local state,
 * so the directory re-sorts and the events feed re-ranks along with the label.
 * A switcher that only changed the heading would be a lie told at page-title
 * size.
 *
 * Cities with no source behind them are listed but marked — we can point the
 * map at Chicago, we just have nothing to show there yet, and saying so is
 * more useful than hiding the row and leaving someone wondering.
 */
function CityPicker({
  current,
  pinned = false,
  nav = false,
}: {
  current: string | null;
  pinned?: boolean;
  nav?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Change city"
        aria-expanded={open}
        aria-haspopup="menu"
        title="Change city"
        className={
          "grid place-items-center rounded-full text-stone-500 transition hover:bg-stone-100 hover:text-stone-900 " +
          (nav ? "h-7 w-7" : "h-8 w-8")
        }
      >
        <Globe className={nav ? "h-4 w-4" : "h-[18px] w-[18px]"} />
      </button>

      {open && (
        <div
          role="menu"
          // Anchored to whichever side the TRIGGER is on. On a phone the city sits
          // right-aligned in the title row, so a left-anchored panel started at
          // x=330 on a 390px screen and ran 164px past the edge — and because
          // <body> is `overflow-x-hidden`, it was clipped to nothing rather than
          // scrolling into view. It looked like the dropdown simply did not open.
          // Desktop keeps left, where the city sits beside the wordmark.
          className="absolute right-0 top-[calc(100%+6px)] z-50 w-56 overflow-hidden rounded-[var(--r-lg)] border border-stone-200 bg-white py-2 shadow-[var(--shadow-overlay)] md:left-0 md:right-auto"
        >
          {CITIES.map((c) => {
            const live = isCityLive(c.id);
            const on = current === c.id;
            return (
              <button
                key={c.id}
                role="menuitem"
                onClick={() => {
                  setCityOverride(c.id);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left transition hover:bg-stone-50"
              >
                <span className="text-base leading-none">{c.emoji}</span>
                <span className={"min-w-0 flex-1 truncate t-body " + (on ? "font-semibold text-stone-900" : "text-stone-700")}>
                  {c.city}
                </span>
                {!live && <span className="t-fine shrink-0 text-stone-400">soon</span>}
                {on && <Check className="h-4 w-4 shrink-0 text-coral-600" />}
              </button>
            );
          })}

          {/* Only offered when a city is pinned — with no pin this is already
              what's happening, and a button that does nothing is worse than no
              button. */}
          {pinned && (
            <>
              <div className="my-2 border-t border-stone-100" />
              <button
                role="menuitem"
                disabled={locating}
                onClick={async () => {
                  setLocating(true);
                  try {
                    await refreshHomePosition(); // also clears the pin
                    setOpen(false);
                  } catch {
                    setCityOverride(null); // refused — drop the pin anyway
                    setOpen(false);
                  } finally {
                    setLocating(false);
                  }
                }}
                className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left t-body text-stone-700 transition hover:bg-stone-50 disabled:opacity-60"
              >
                <LocateFixed className="h-4 w-4 shrink-0 text-stone-400" />
                Use my location
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
