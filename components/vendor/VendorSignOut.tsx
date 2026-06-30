"use client";

import { SignOutButton } from "@clerk/nextjs";

// Client wrapper so the custom <button> child is passed to Clerk's SignOutButton
// inside a client boundary — passing it from the server layout trips Clerk's
// single-child assertion across the RSC boundary.
export function VendorSignOut() {
  return (
    <SignOutButton redirectUrl="/vendor/sign-in">
      <button className="whitespace-nowrap text-xs text-stone-500 hover:text-stone-900 sm:text-sm">
        Sign out
      </button>
    </SignOutButton>
  );
}
