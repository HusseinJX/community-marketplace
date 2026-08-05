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
// The city registry currently lives in lib/prototype-data (PLACES +
// CITY_COORDS + nearestPlace). Only pure data and haversine are imported, no
// prototype UI. When cities become real rows, move the registry out of there
// and this import is the one thing to repoint.

import { useState } from "react";
import { Check } from "lucide-react";
import { useHomePosition } from "@/lib/home-position";
import { nearestPlace, PLACES, type Place } from "@/lib/prototype-data";
import { trackConversion } from "@/lib/analytics";

const FALLBACK: Place | undefined = PLACES.find((p) => p.status === "live");
const INTEREST_KEY = "wl_city_interest";

export function CityHeader() {
  const { position, settled } = useHomePosition();
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
  const near = position ? nearestPlace(position.lat, position.lng)?.place ?? null : null;
  const live = position
    ? nearestPlace(position.lat, position.lng, { activeOnly: true })?.place ?? null
    : null;

  // Say nothing until we actually know where they are.
  //
  // Falling back to the one live city looks harmless and is not: "Near you in
  // San Francisco" shown to someone in Chicago who denied location is a
  // confidently wrong statement, and the feed below already offers to turn
  // location on. A missing line beats a false one.
  if (!settled || !near) return null;

  const servedHere = near.status === "live";
  const cover = live ?? FALLBACK;

  if (servedHere) {
    // Just the city, at page-title size. "Near you in San Francisco" spent most
    // of a line explaining a mechanic; the name alone says where you are, and
    // the surfaces below already say they're sorted by distance.
    return (
      <h1 className="truncate text-2xl font-semibold tracking-tight text-stone-900">
        {near.city}
      </h1>
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
