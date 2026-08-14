"use client";

// ONE position lookup for the whole home screen.
//
// This used to live inside PersonalizedEvents. It moved out the moment a second
// surface wanted the same thing: two components each calling
// getCurrentPosition() is two permission dialogs on a cold load, and iOS shows
// them one after the other. Anything on home that needs "where am I" imports
// this — never `getUserPosition` directly.
//
// Cached at MODULE scope because home tabs unmount their inactive tab, so a
// component-local cache is thrown away on every tab switch. Cached in
// localStorage as well because module scope dies on reload, and a fresh
// getCurrentPosition() per reload is silent where the permission is a standing
// grant but a dialog on every launch where it is not (a dismissed browser
// prompt, or iOS "Allow Once", which lapses when the app is backgrounded).
//
// Rounded to ~110m on disk: this places someone in a neighbourhood and sorts by
// miles, and nothing downstream reads finer, so there is no reason to keep a
// doorstep in storage.

import { useEffect, useState } from "react";
import { getUserPosition } from "@/lib/native-geo";
import { cityById } from "@/lib/cities";

export interface Position {
  lat: number;
  lng: number;
}

const KEY = "wl_home_pos";
const TTL_MS = 24 * 60 * 60 * 1000;

// ── City override ───────────────────────────────────────────────────────────
// "Show me Oakland" — a deliberate choice that outranks the device fix.
//
// It lives HERE rather than in the city header because switching city has to
// move the whole page: the directory sorts by distance, the events feed ranks
// by proximity, and the header names the place. If the switcher owned its own
// state, the label would say Oakland while every list below it stayed sorted
// around San Francisco — which is worse than not offering the control.
//
// No TTL. A device fix expires because you move; a stated preference does not.
// Clearing it is an explicit "Use my location" in the picker.

const CITY_KEY = "wl_home_city";

let overrideId: string | null | undefined; // undefined = not yet read from disk
const listeners = new Set<() => void>();

function readOverride(): string | null {
  if (overrideId !== undefined) return overrideId;
  if (typeof window === "undefined") return null;
  try {
    overrideId = window.localStorage.getItem(CITY_KEY);
  } catch {
    overrideId = null;
  }
  return overrideId;
}

/** The city id the reader pinned, or null when following the device. */
export function cityOverride(): string | null {
  return readOverride();
}

/** Pin a city (or null to go back to the device fix). Notifies every surface. */
export function setCityOverride(id: string | null): void {
  overrideId = id;
  try {
    if (id) window.localStorage.setItem(CITY_KEY, id);
    else window.localStorage.removeItem(CITY_KEY);
  } catch {
    /* private mode — the choice just doesn't survive a reload */
  }
  for (const fn of listeners) fn();
}

function overridePosition(): Position | null {
  const id = readOverride();
  if (!id) return null;
  const c = cityById(id);
  return c ? { lat: c.lat, lng: c.lng } : null;
}

export function readStoredPosition(): Position | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as { lat?: number; lng?: number; at?: number };
    if (typeof v.lat !== "number" || typeof v.lng !== "number" || typeof v.at !== "number") return null;
    if (Date.now() - v.at > TTL_MS) return null;
    return { lat: v.lat, lng: v.lng };
  } catch {
    return null; // private mode, or something else wrote the key
  }
}

export function storePosition(pos: Position): void {
  try {
    const r = (n: number) => Math.round(n * 1000) / 1000;
    window.localStorage.setItem(KEY, JSON.stringify({ lat: r(pos.lat), lng: r(pos.lng), at: Date.now() }));
  } catch {
    /* private mode — we just re-ask next load */
  }
}

let cached: Position | null = null;
let refused = false;
// In-flight request, so two components mounting in the same tick share one
// call instead of racing the device for two.
let inflight: Promise<Position | null> | null = null;

export function cachedPosition(): Position | null {
  return cached;
}

/** Resolve a position at most once per session. Null = unavailable or refused. */
export function getHomePosition(): Promise<Position | null> {
  // A pinned city wins over everything, and short-circuits before the device
  // is ever asked — so someone browsing another city is never prompted for a
  // location they've already told us not to use.
  const pinned = overridePosition();
  if (pinned) return Promise.resolve(pinned);
  if (cached) return Promise.resolve(cached);
  if (refused) return Promise.resolve(null);
  if (inflight) return inflight;

  inflight = (async () => {
    const stored = readStoredPosition();
    if (stored) {
      cached = stored;
      return stored;
    }
    try {
      const [lat, lng] = await getUserPosition();
      cached = { lat, lng };
      storePosition(cached);
      return cached;
    } catch {
      refused = true;
      return null;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

/**
 * Force a fresh device fix (the "use my location" button).
 *
 * Clears any pinned city: asking for your location while a city is pinned can
 * only mean you want the pin gone, and leaving it would make the button look
 * broken — it would fetch a real fix and then quietly ignore it.
 */
export async function refreshHomePosition(): Promise<Position> {
  const [lat, lng] = await getUserPosition();
  cached = { lat, lng };
  refused = false;
  storePosition(cached);
  setCityOverride(null);
  return cached;
}

export interface HomePositionState {
  position: Position | null;
  /** False until the first attempt has settled — distinguishes "no" from "not yet". */
  settled: boolean;
}

/** Position for any home surface. Renders immediately; never blocks on the dialog. */
export function useHomePosition(): HomePositionState {
  const [position, setPosition] = useState<Position | null>(cached);
  const [settled, setSettled] = useState<boolean>(!!cached || refused);
  // Bumped when the pinned city changes, to re-run the effect below. Every
  // surface using this hook subscribes, so picking a city re-sorts the
  // directory and re-ranks the feed in the same tick as the label changing.
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const fn = () => setTick((n) => n + 1);
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);

  // Always via the promise, even when the answer is already cached —
  // getHomePosition() resolves instantly in that case, and going through it
  // keeps this out of the "setState synchronously inside an effect" shape that
  // forces a second render pass on every mount.
  useEffect(() => {
    let cancelled = false;
    void getHomePosition().then((p) => {
      if (cancelled) return;
      setPosition(p);
      setSettled(true);
    });
    return () => {
      cancelled = true;
    };
  }, [tick]);

  return { position, settled };
}
