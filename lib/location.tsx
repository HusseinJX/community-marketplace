"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

// The "place lens" — the app's primary geographic scope. A shopper picks where
// they are (city, optionally a neighborhood) and events, the directory, and
// "collaborators near you" all scope to it. Persisted in localStorage so it
// follows the user across pages and sessions.

export interface Place {
  city: string;
  neighborhood: string;
}

const EMPTY: Place = { city: "", neighborhood: "" };
const KEY = "wl_place_v1";

interface Ctx {
  place: Place;
  setPlace: (p: Place) => void;
  clear: () => void;
  ready: boolean;
}

const LocationContext = createContext<Ctx | null>(null);

export function LocationProvider({ children }: { children: ReactNode }) {
  const [place, setPlaceState] = useState<Place>(EMPTY);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setPlaceState({ ...EMPTY, ...JSON.parse(raw) });
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  const setPlace = (p: Place) => {
    setPlaceState(p);
    try {
      localStorage.setItem(KEY, JSON.stringify(p));
    } catch {
      /* ignore */
    }
  };

  return (
    <LocationContext.Provider value={{ place, setPlace, clear: () => setPlace(EMPTY), ready }}>
      {children}
    </LocationContext.Provider>
  );
}

export function useLocation(): Ctx {
  return (
    useContext(LocationContext) ?? { place: EMPTY, setPlace: () => {}, clear: () => {}, ready: true }
  );
}

const norm = (s?: string | null) => (s || "").trim().toLowerCase();

export function placeLabel(p: Place): string {
  if (p.neighborhood && p.city) return `${p.neighborhood}, ${p.city}`;
  return p.neighborhood || p.city || "All areas";
}

export function placeIsSet(p: Place): boolean {
  return !!(p.city || p.neighborhood);
}

// Does a target (event, member) fall within the selected place? "All areas"
// (empty) matches everything. City must match if set; neighborhood narrows
// further only when both the lens and the target specify one.
export function matchesPlace(p: Place, target: { city?: string | null; neighborhood?: string | null }): boolean {
  if (!placeIsSet(p)) return true;
  if (p.city && norm(target.city) !== norm(p.city)) return false;
  if (p.neighborhood && norm(target.neighborhood) && norm(target.neighborhood) !== norm(p.neighborhood)) return false;
  return true;
}
