"use client";

import { Bookmark } from "lucide-react";
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
// Amber, matching the event star (SaveEventButton): a save is a save whether
// the thing is a business or an event, and two colours for one idea would read
// as two different features.
export function SaveBusinessButton({
  memberId,
  variant = "pill",
  className,
}: {
  memberId: string;
  /** pill = the profile action row · chip = on a card, beside Directions */
  variant?: "pill" | "chip";
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
    variant === "chip"
      ? // relative z-10 for the same reason as the Directions chip: the card is
        // a stretched link and this would otherwise sit underneath it.
        "relative z-10 inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold shadow-sm transition " +
        (isSaved ? "bg-amber-400 text-stone-900" : "bg-white/90 text-stone-700 hover:bg-white")
      : "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 py-2 text-[13px] font-medium transition " +
        (isSaved
          ? "border-amber-300 bg-amber-50 text-amber-700"
          : "border-stone-200 bg-white text-stone-700 hover:border-amber-300 hover:text-amber-700");

  const icon = variant === "chip" ? "h-3 w-3" : "h-4 w-4";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isSaved}
      aria-label={label}
      title={label}
      className={className ?? styles}
    >
      <Bookmark className={`${icon} ${isSaved ? "fill-amber-500 text-amber-600" : ""}`} />
      {isSaved ? "Saved" : "Save"}
    </button>
  );
}
