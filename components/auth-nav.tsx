"use client";

import Link from "next/link";
import { Show, SignInButton, UserButton } from "@clerk/nextjs";
import { Heart, ShoppingBag, User } from "lucide-react";
import { useStore } from "@/lib/store";

export function AuthNav() {
  const { favorites, cart } = useStore();

  return (
    <nav className="flex items-center gap-1.5">
      <Link
        href="/events"
        className="mr-1 inline-flex rounded-full px-3 py-1.5 text-sm font-medium text-stone-700 transition hover:bg-stone-100 hover:text-stone-900"
      >
        Feed
      </Link>

      <IconLink href="/favorites" label="Favorites" count={favorites.length}>
        <Heart className="h-5 w-5" />
      </IconLink>

      <IconLink href="/cart" label="Cart" count={cart.length}>
        <ShoppingBag className="h-5 w-5" />
      </IconLink>

      <Show
        when="signed-out"
        fallback={<UserButton />}
      >
        <SignInButton mode="modal">
          <button className="ml-1 inline-flex h-9 w-9 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-700 transition hover:border-indigo-200 hover:text-indigo-700">
            <User className="h-4 w-4" />
          </button>
        </SignInButton>
      </Show>
    </nav>
  );
}

function IconLink({
  href,
  label,
  count,
  children,
}: {
  href: string;
  label: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="relative inline-flex h-9 w-9 items-center justify-center rounded-full text-stone-600 transition hover:bg-stone-100 hover:text-stone-900"
    >
      {children}
      {count > 0 && (
        <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-indigo-600 px-1 text-[10px] font-semibold text-white">
          {count}
        </span>
      )}
    </Link>
  );
}
