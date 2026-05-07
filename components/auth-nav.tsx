"use client";

import Link from "next/link";
import { Show, SignInButton, UserButton } from "@clerk/nextjs";
import { useStore } from "@/lib/store";

function HeartIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
    </svg>
  );
}

function BagIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
    </svg>
  );
}

export function AuthNav() {
  const { favorites, cart } = useStore();

  return (
    <div className="flex items-center gap-4">
      <Link
        href="/favorites"
        className="relative text-stone-600 hover:text-indigo-700 transition-colors"
        aria-label="Favorites"
      >
        <HeartIcon />
        {favorites.length > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white">
            {favorites.length > 9 ? '9+' : favorites.length}
          </span>
        )}
      </Link>

      <Link
        href="/cart"
        className="relative text-stone-600 hover:text-indigo-700 transition-colors"
        aria-label="Inquiry list"
      >
        <BagIcon />
        {cart.length > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white">
            {cart.length > 9 ? '9+' : cart.length}
          </span>
        )}
      </Link>

      <Show when="signed-out" fallback={<UserButton />}>
        <SignInButton mode="modal">
          <button className="rounded-full bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 transition-colors">
            Sign in
          </button>
        </SignInButton>
      </Show>
    </div>
  );
}
