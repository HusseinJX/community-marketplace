"use client";

import { Heart } from "lucide-react";
import { useAuth } from "@clerk/nextjs";
import { useLogin } from "@/components/auth/ClerkAuthProvider";
import { useSavedMembers } from "@/lib/data-hooks";

// Save a business to come back to it later.
//
// ONE component for the shop card and the profile action row, so the two can't
// disagree about what "Saved" means. Before this, the profile's Save button was
// local useState — it looked saved until you reloaded, and nothing was ever
// written anywhere.
//
// Coral, matching the event save (SaveEventButton): a save is a save whether
// the thing is a business or an event, and two colours for one idea would read
// as two different features. Saved is one of the few states that earns the
// accent — it is the reader's own mark on the page.
export function SaveBusinessButton({
  memberId,
  variant = "pill",
  corner = "right",
  className,
}: {
  memberId: string;
  /** pill = profile action row · chip = beside Directions · overlay = on the photo */
  variant?: "pill" | "chip" | "overlay";
  /**
   * Which top corner the overlay sits in. A real prop rather than a `left-2`
   * through `className`, for the reason spelled out in SaveEventButton: both
   * set the same property and the winner would depend on Tailwind's emit order.
   */
  corner?: "left" | "right";
  className?: string;
}) {
  const { isSignedIn } = useAuth();
  const openLogin = useLogin();
  const { saved, toggle } = useSavedMembers();
  const isSaved = saved.has(memberId);

  async function onClick(e: React.MouseEvent) {
    // The card is one big <Link>. Without both of these a save press navigates
    // to the profile instead of saving — the likeliest way this breaks.
    e.preventDefault();
    e.stopPropagation();
    if (!isSignedIn) {
      // A save has to belong to someone; there is nowhere to put an anonymous one.
      openLogin();
      return;
    }
    await toggle(memberId);
  }

  const label = isSaved ? "Saved — tap to remove" : "Save for later";

  const styles =
    variant === "overlay"
      ? // Floats on a photo that may be any colour. Airbnb's heart has no
        // backdrop plate — it's a white glyph with a dark stroke, which stays
        // legible on anything without putting a grey disc over the photo.
        // Same shape and position as the event save (SaveEventButton) — one
        // gesture, whether the card is a business or an event.
        `absolute ${corner === "left" ? "left-3" : "right-3"} top-3 z-10 grid h-8 w-8 place-items-center rounded-full transition hover:scale-110 active:scale-95`
      : variant === "chip"
        ? // relative z-10 for the same reason as the Directions chip: the card
          // is a stretched link and this would otherwise sit underneath it.
          "relative z-10 inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold shadow-sm transition " +
          (isSaved ? "bg-coral-600 text-white" : "bg-white/90 text-stone-700 hover:bg-white")
        : "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 py-2 text-[13px] font-medium transition " +
          (isSaved
            ? "border-coral-200 bg-coral-50 text-coral-700"
            : "border-stone-200 bg-white text-stone-700 hover:border-coral-200 hover:text-coral-700");

  const icon = variant === "chip" ? "h-3 w-3" : variant === "overlay" ? "h-6 w-6" : "h-4 w-4";
  // The overlay is icon-only — a word would not fit in a 32px circle.
  const showText = variant !== "overlay";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isSaved}
      aria-label={label}
      title={label}
      className={className ?? styles}
    >
      <Heart
        className={`${icon} transition ${
          isSaved
            ? "fill-coral-600 text-coral-600"
            : variant === "overlay"
              ? // Unsaved on a photo: translucent black fill + white stroke.
                // Legible over a white wall and a night shot alike, which a
                // plain outline is not.
                "fill-black/25 text-white drop-shadow-sm"
              : ""
        }`}
      />
      {showText && (isSaved ? "Saved" : "Save")}
    </button>
  );
}
