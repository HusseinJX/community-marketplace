"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

// Top bar: left "+" (post/share), center "WhatsLocal" wordmark (links home),
// right theme toggle. The cart is gone from the front door — commerce is
// supporting cast, and an always-empty bag was a dead control (checkout is still
// reachable at /cart).
export function TopNav() {
  const pathname = usePathname();

  // On the admin surfaces (the vendor portal or the /demo launcher) the "+"
  // opens the vendor post composer (Go Live) instead of the shopper share page.
  // Demo mode exits when you leave these for the shopper side (DemoExitWatcher),
  // so pathname alone is the right signal — no lingering cookie to consult.
  const adminContext =
    (pathname?.startsWith("/vendor") || pathname?.startsWith("/demo")) ?? false;
  const shareHref = adminContext ? "/share?vendor=1" : "/share";

  return (
    <div className="relative grid h-14 grid-cols-3 items-center px-4">
      {/* Left — post/share */}
      <div className="flex justify-start">
        <Link
          href={shareHref}
          aria-label={adminContext ? "Post as your business" : "Share a post"}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-stone-800 transition hover:bg-stone-100"
        >
          <Plus className="h-6 w-6" />
        </Link>
      </div>

      {/* Center — brand lockup (mark + wordmark, links home) */}
      <div className="flex justify-center">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-lg font-semibold tracking-tight text-stone-900"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" className="h-7 w-7" />
          WhatsLocal
        </Link>
      </div>

      {/* Right — theme toggle (in the slot the cart vacated).
          Hidden in production for now; light is the only public theme. */}
      <div className="flex justify-end">
        {process.env.NODE_ENV !== "production" && <ThemeToggle />}
      </div>
    </div>
  );
}
