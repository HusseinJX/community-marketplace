"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useMyMemberId } from "@/lib/data-hooks";

// Top bar: centred "WhatsLocal AI" wordmark (links home), with "+" (post/share,
// businesses only) on the left and the theme toggle on the right. The cart is
// gone from the front door —
// commerce is supporting cast, and an always-empty bag was a dead control
// (checkout is still reachable at /cart).
export function TopNav() {
  const pathname = usePathname();
  const { memberId } = useMyMemberId();

  // On the admin surfaces (the vendor portal or the /demo launcher) the "+"
  // opens the vendor post composer (Go Live) instead of the shopper share page.
  // Demo mode exits when you leave these for the shopper side (DemoExitWatcher),
  // so pathname alone is the right signal — no lingering cookie to consult.
  const adminContext =
    (pathname?.startsWith("/vendor") || pathname?.startsWith("/demo")) ?? false;
  const shareHref = adminContext ? "/share?vendor=1" : "/share";

  // Posting is a BUSINESS action, so the "+" belongs to people who have a
  // business to post as. A signed-out visitor tapping it got a sign-in wall,
  // and a shopper got a composer asking which of their businesses to post as
  // when they have none — the control was advertising a door neither could
  // open. Vendors keep it everywhere, including the shopper side, since they
  // browse there too.
  //
  // Hidden until we know: the hook starts null, so the "+" fades in for a
  // vendor rather than flashing up and being taken away from a shopper. That
  // is the right way round — an appearing control is a smaller lie than a
  // disappearing one.
  //
  // The admin surfaces show it regardless, because reaching them at all means
  // either a signed-in vendor or an unlocked admin demo (which has no Clerk
  // user to look up, and whose whole point is exercising this UI).
  const canPost = adminContext || !!memberId;

  return (
    // Three equal columns, so the wordmark is centred on the SCREEN rather
    // than between whatever happens to flank it — the "+" comes and goes with
    // who is signed in, and a flex row would have shifted the brand with it.
    // px matches the page body (max-w-6xl px-4 md:px-8) so the logo and the
    // toggle line up with the search bar and the cards below.
    <div className="relative grid h-14 grid-cols-3 items-center px-4 md:px-8">
      {/* Left — post/share. Empty for shoppers and signed-out visitors; the
          column stays so the wordmark doesn't shift between the two. */}
      <div className="flex justify-start">
        {canPost && (
          <Link
            href={shareHref}
            aria-label={adminContext ? "Post as your business" : "Share a post"}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-stone-800 transition hover:bg-stone-100"
          >
            <Plus className="h-6 w-6" />
          </Link>
        )}
      </div>

      {/* Centre — brand lockup (mark + wordmark, links home) */}
      <div className="flex min-w-0 justify-center">
        <Link
          href="/"
          className="inline-flex min-w-0 items-center gap-1.5 text-lg font-semibold tracking-tight text-stone-900"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" className="h-7 w-7 shrink-0" />
          <span className="truncate">WhatsLocal AI</span>
        </Link>
      </div>

      {/* Right — theme toggle. Hidden in production; light is the only public
          theme. */}
      <div className="flex justify-end">
        {process.env.NODE_ENV !== "production" && <ThemeToggle />}
      </div>
    </div>
  );
}
