"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { User, LogIn, ArrowRight, Store } from "lucide-react";
import { VendorPhoneLogin } from "@/components/auth/VendorPhoneLogin";

// Vendor login — same model as the shopper page: a public landing with a modal
// sign-in (not a whole embedded <SignIn/> page). Top row mirrors /shopper: a
// "Shopper" button to cross over, and "Log in" on the right.
export default function VendorSignInPage() {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();
  const [loginOpen, setLoginOpen] = useState(false);

  // Already signed in (e.g. came back to this URL) → into the portal.
  useEffect(() => {
    if (isLoaded && isSignedIn) router.replace("/vendor");
  }, [isLoaded, isSignedIn, router]);

  return (
    <div className="mx-auto min-h-screen max-w-md space-y-8 px-4 py-10 md:px-8">

      {/* Top utility row (above the title): cross to the shopper side on the
          left, log in on the right. */}
      <div className="flex items-center justify-between gap-2">
        <Link
          href="/shopper"
          className="inline-flex items-center gap-1.5 rounded-full border border-stone-300 px-3.5 py-2 text-[13px] font-semibold text-stone-800 transition hover:bg-stone-50"
        >
          <User className="h-4 w-4 text-teal-500" /> Shopper
        </Link>
        <button
          onClick={() => setLoginOpen(true)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-stone-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-stone-800"
        >
          <LogIn className="h-4 w-4" /> Log in
        </button>
      </div>

      {/* Title */}
      <div>
        <h1 className="text-xl font-semibold text-stone-900">Vendor portal</h1>
        <p className="mt-1 text-sm text-stone-500">
          Sign in to manage your business, org, or artist page — products, events, live, collabs,
          and your AI agent.
        </p>
      </div>

      {/* New here → onboarding */}
      <Link
        href="/join"
        className="flex items-center justify-between rounded-2xl border border-stone-200 bg-white p-4 transition hover:bg-stone-50"
      >
        <span className="flex items-center gap-3">
          <Store className="h-5 w-5 text-violet-600" />
          <span>
            <span className="block text-sm font-semibold text-stone-900">Set up a new page</span>
            <span className="block text-xs text-stone-500">
              Don&apos;t have a vendor account yet? Start onboarding.
            </span>
          </span>
        </span>
        <ArrowRight className="h-4 w-4 text-stone-400" />
      </Link>

      {loginOpen && <VendorPhoneLogin onClose={() => setLoginOpen(false)} redirectUrl="/vendor" />}
    </div>
  );
}
