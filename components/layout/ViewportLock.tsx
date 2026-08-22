"use client";

import { useEffect } from "react";

/**
 * Pins the whole document to the viewport for a full-screen view: the page
 * stops scrolling, and whatever inside it opted to scroll is the only thing
 * that moves.
 *
 * Why a body flag rather than `height: calc(100dvh - var(--app-chrome))` on the
 * page itself, which is what the older chat surfaces do: that calc has to name
 * every piece of chrome, and it silently stops being true when a piece appears
 * or disappears — the desktop app banner adds ~55px, the mobile bottom-nav
 * spacer subtracts 52px, and the page ends up a few pixels taller than the
 * screen, which is exactly enough to scroll. Locking the body and letting the
 * existing flex column resolve the leftover space is measured rather than
 * guessed, whatever is on screen.
 *
 * The body outlives this component, so the cleanup is the load-bearing half:
 * leave the flag set and every page you visit next is stuck at one screen with
 * its content cut off. Same reason MessagesShell cleans up `data-chat-open`.
 */
export function ViewportLock() {
  useEffect(() => {
    document.body.dataset.viewportLock = "true";
    return () => {
      delete document.body.dataset.viewportLock;
    };
  }, []);
  return null;
}
