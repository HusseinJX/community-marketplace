"use client";

import { Show, SignInButton, UserButton } from "@clerk/nextjs";

export function AuthNav() {
  return (
    <>
      <Show when="signed-out" fallback={<UserButton />}>
        <SignInButton mode="modal">
          <button className="rounded-full bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 transition-colors">
            Sign in
          </button>
        </SignInButton>
      </Show>
    </>
  );
}
