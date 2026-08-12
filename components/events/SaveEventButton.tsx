"use client";

import { Star } from "lucide-react";
import { useAuth } from "@clerk/nextjs";
import { useLogin } from "@/components/auth/ClerkAuthProvider";
import { useSavedEvents } from "@/lib/data-hooks";

// Star an event to come back to it later.
//
// Every event card is wrapped in a <Link>, so this MUST swallow the click —
// without preventDefault a star press navigates to the event instead of saving
// it, which is the single most likely way this feature breaks.

export function SaveEventButton({
  eventId,
  variant = "overlay",
  corner = "right",
  className = "",
}: {
  eventId: string;
  /** `overlay` floats on a card image; `inline` sits in a row of controls. */
  variant?: "overlay" | "inline";
  /**
   * Which top corner the overlay sits in. A real prop rather than a `left-2`
   * passed through `className`: both would set the same CSS property, and which
   * one won would depend on the order Tailwind happened to emit them in — a
   * silent, layout-dependent coin flip. The For-you cards put their badges top
   * -right, so the star goes left there.
   */
  corner?: "left" | "right";
  className?: string;
}) {
  const { isSignedIn } = useAuth();
  const openLogin = useLogin();
  const { saved, toggle } = useSavedEvents();
  const isSaved = saved.has(eventId);

  async function onClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!isSignedIn) {
      // A save has to belong to someone — there's nowhere to put an anonymous star.
      openLogin();
      return;
    }
    await toggle(eventId);
  }

  const label = isSaved ? "Saved — tap to remove" : "Save for later";

  if (variant === "inline") {
    return (
      <button
        onClick={onClick}
        aria-pressed={isSaved}
        aria-label={label}
        title={label}
        className={
          "inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium transition " +
          (isSaved
            ? "text-amber-600 hover:bg-amber-50"
            : "text-stone-500 hover:bg-stone-100 hover:text-stone-700") +
          (className ? ` ${className}` : "")
        }
      >
        <Star className={"h-4 w-4 " + (isSaved ? "fill-amber-500 text-amber-500" : "")} />
        {isSaved ? "Saved" : "Save"}
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      aria-pressed={isSaved}
      aria-label={label}
      title={label}
      className={
        // Sits over a photo that may be any colour, so it carries its own
        // backdrop rather than relying on contrast with the image.
        `absolute ${corner === "left" ? "left-2" : "right-2"} top-2 z-10 grid h-8 w-8 place-items-center rounded-full bg-white/85 shadow-sm backdrop-blur transition hover:bg-white active:scale-95 ` +
        className
      }
    >
      <Star
        className={"h-4 w-4 transition " + (isSaved ? "fill-amber-500 text-amber-500" : "text-stone-600")}
      />
    </button>
  );
}
