"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Show, SignInButton, UserButton } from "@clerk/nextjs";
import { Heart, Plane, ShoppingBag, User } from "lucide-react";
import { useStore } from "@/lib/store";

export function AuthNav() {
  const { favorites, cart } = useStore();
  const pathname = usePathname();
  const onTravel = pathname.startsWith("/world-cup");

  return (
    <nav className="flex items-center gap-2">
      <Link
        href="/live"
        className="mr-1 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-rose-600 transition hover:bg-rose-50"
      >
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-500 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-600" />
        </span>
        Live
      </Link>

      <Link
        href="/events"
        className="mr-1 inline-flex rounded-full px-3 py-1.5 text-sm font-medium text-stone-700 transition hover:bg-stone-100 hover:text-stone-900"
      >
        Feed
      </Link>

      {onTravel ? (
        <span className="mr-1 inline-flex cursor-default items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-stone-400">
          <Plane className="h-4 w-4" /> Travel
        </span>
      ) : (
        <Link
          href="/world-cup"
          className="mr-1 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-stone-700 transition hover:bg-stone-100 hover:text-stone-900"
        >
          <Plane className="h-4 w-4" /> Travel
        </Link>
      )}

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
