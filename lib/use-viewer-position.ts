"use client";

// Where the viewer is, resolved once and shared by every location-gated surface.
//
// Community chats gate on proximity, so the card in the feed and the room itself
// must agree — and neither should trigger its own permission prompt. This
// resolves the fix once per page load and caches it in module scope, so a feed
// with three room cards makes one lookup, not three.
//
// Coarse + cached by default (see lib/native-geo.ts) — a room's join radius is
// hundreds of metres, so waiting on GPS to converge would buy nothing.

import { useEffect, useState } from "react";
import { getUserPosition } from "@/lib/native-geo";

export type PositionState =
  /** Still resolving — render a skeleton, not a locked state. */
  | { status: "locating"; coords: null }
  /** Got a fix. */
  | { status: "ready"; coords: [number, number] }
  /** Denied or unavailable. Surfaces are shown in preview (locked) rather than
   *  hidden, so the mechanic is still legible without permission. */
  | { status: "unavailable"; coords: null };

let cached: [number, number] | null = null;
let inflight: Promise<[number, number]> | null = null;

// Dev-only: `?at=37.7596,-122.4269` pretends you're standing somewhere, so a
// location-gated surface can be worked on without walking to it. Stripped in
// production — a spoofable position would defeat the entire mechanic.
function devOverride(): [number, number] | null {
  if (process.env.NODE_ENV === "production" || typeof window === "undefined") return null;
  const raw = new URLSearchParams(window.location.search).get("at");
  const [lat, lng] = (raw ?? "").split(",").map(Number);
  return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
}

export function useViewerPosition(): PositionState {
  const [state, setState] = useState<PositionState>(() =>
    cached ? { status: "ready", coords: cached } : { status: "locating", coords: null }
  );

  useEffect(() => {
    const spoofed = devOverride();
    if (spoofed) {
      setState({ status: "ready", coords: spoofed });
      return;
    }
    if (cached) return;
    let alive = true;
    inflight ??= getUserPosition();
    inflight
      .then((c) => {
        cached = c;
        if (alive) setState({ status: "ready", coords: c });
      })
      .catch(() => {
        inflight = null; // let a later mount retry (permission may be granted by then)
        if (alive) setState({ status: "unavailable", coords: null });
      });
    return () => {
      alive = false;
    };
  }, []);

  return state;
}
