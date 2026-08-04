"use client";

// Starred community chats, kept in localStorage.
//
// A room is invisible unless you're standing near it — so starring is what turns
// a place you stumbled into into somewhere you can get back to. That list is the
// only durable trace of a room, which is why it surfaces on /shopper.
//
// UI-only for now (no table, same staging as demo-petitions' optimistic signing).
// When this gets a backend, only this file changes — every consumer goes through
// the hook.

import { useCallback, useEffect, useState } from "react";

const KEY = "wl_starred_chats";

function read(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function write(ids: string[]): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    /* private mode / quota — starring just won't persist */
  }
  // Same-tab listeners: `storage` only fires in *other* tabs, so a card and the
  // profile page rendered together would otherwise disagree until reload.
  window.dispatchEvent(new Event(EVENT));
}

const EVENT = "wl:starred-chats";

export function useStarredChats() {
  // Starts empty so SSR and the first client render agree, then fills on mount.
  const [ids, setIds] = useState<string[]>([]);

  useEffect(() => {
    const sync = () => setIds(read());
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const toggle = useCallback((id: string) => {
    const next = read().includes(id) ? read().filter((x) => x !== id) : [...read(), id];
    write(next);
    setIds(next);
  }, []);

  const isStarred = useCallback((id: string) => ids.includes(id), [ids]);

  return { starredIds: ids, isStarred, toggle };
}
