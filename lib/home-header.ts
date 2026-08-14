"use client";

import { useEffect, useState } from "react";

/**
 * The collapsing home header, shared between two components that can't see
 * each other.
 *
 * The wordmark row lives in `TopNav`, which `app/layout.tsx` renders OUTSIDE
 * `{children}`. The city row, the tab switcher and the search live in
 * `HomeTabs`, which is inside them. When the header collapses, the search has
 * to move from the second component into the first — so the state has to sit
 * somewhere both can reach.
 *
 * A module-level store with listeners rather than a React context, because a
 * context would have to wrap the header AND the page in the root layout, which
 * means making a server component that renders on every route pay for a
 * behaviour that only exists on one. Same pattern lib/home-position already
 * uses for the shared city.
 */

type State = {
  /** True while the home header is mounted. Off on every other route. */
  active: boolean;
  /** Scrolled past the threshold — the search rides in the wordmark row. */
  collapsed: boolean;
  /**
   * Expanded by a deliberate tap on the compact pill, overriding the scroll
   * position. Cleared the next time the reader scrolls: they've reached for
   * the search, used it or not, and then moved on.
   */
  pinned: boolean;
  /** What the compact pill should say — the live query, or the placeholder. */
  label: string;
};

/**
 * ── The store is anchored to globalThis, and it has to be ───────────────────
 * `TopNav` is reached from the ROOT LAYOUT and `HomeTabs` from the PAGE, which
 * are separate client entry graphs. The bundler is free to emit this module
 * into both — and in dev it does — giving each half its own module registry
 * instance with its own `state` object.
 *
 * The symptom was maddening and worth recording: scrolling collapsed the
 * header correctly (page instance), the compact pill rendered correctly (layout
 * instance), and tapping the pill did nothing at all — because it flipped a
 * flag on an object nothing was reading. Invoking the click handler by hand
 * from the console also did nothing, which is what finally ruled out the event
 * plumbing and pointed here.
 *
 * A single object on globalThis is shared no matter how many times the module
 * is evaluated. Any future cross-layout/page state must do the same.
 */
type Store = { state: State; listeners: Set<() => void> };

const KEY = "__wl_home_header__";
const g = globalThis as unknown as Record<string, Store | undefined>;

const store: Store =
  g[KEY] ??
  (g[KEY] = {
    state: { active: false, collapsed: false, pinned: false, label: "" },
    listeners: new Set<() => void>(),
  });

const state = store.state;
const listeners = store.listeners;

function emit() {
  for (const fn of listeners) fn();
}

export function setHeaderActive(active: boolean) {
  if (state.active === active) return;
  state.active = active;
  // Leaving home resets the rest, so returning later starts expanded rather
  // than inheriting a collapsed state from the last visit.
  if (!active) {
    state.collapsed = false;
    state.pinned = false;
  }
  emit();
}

export function setHeaderCollapsed(collapsed: boolean) {
  if (state.collapsed === collapsed) return;
  state.collapsed = collapsed;
  emit();
}

export function setHeaderLabel(label: string) {
  if (state.label === label) return;
  state.label = label;
  emit();
}

/** Tapping the compact pill: open the header where you are, don't scroll. */
export function expandHeader() {
  state.pinned = true;
  state.collapsed = false;
  emit();
}

/** The reader scrolled — a pin only survives until they move again. */
export function releaseHeaderPin() {
  if (!state.pinned) return;
  state.pinned = false;
  emit();
}

export function useHomeHeader(): State {
  const [, force] = useState(0);
  useEffect(() => {
    const fn = () => force((n) => n + 1);
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);
  return state;
}
