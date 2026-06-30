"use client";

import { useEffect } from "react";
import Script from "next/script";
import { useUser } from "@clerk/nextjs";
import { MessageCircle } from "lucide-react";

// Feedbase feedback widget. The script injects its own UI; we just load it once
// (app-wide) and tell it who the signed-in user is so feedback is attributed.
// The footer "Send feedback" link (FeedbackLink) is a subtle entry point that
// opens the widget on demand.

interface FeedbaseWidgetApi {
  identify?: (user: { id: string; name?: string | null; email?: string | null }) => void;
  open?: () => void;
}

declare global {
  interface Window {
    FeedbaseWidget?: FeedbaseWidgetApi;
  }
}

/** Loads the widget script + identifies the Clerk user once. Renders nothing. */
export function FeedbackWidget() {
  const { user, isLoaded } = useUser();

  useEffect(() => {
    if (!isLoaded || !user) return;
    window.FeedbaseWidget?.identify?.({
      id: user.id,
      name: user.fullName,
      email: user.primaryEmailAddress?.emailAddress,
    });
  }, [isLoaded, user]);

  return (
    <Script
      src="https://steady-capybara-52fa2d.netlify.app/widget.js"
      strategy="afterInteractive"
      data-project="community-marketplace"
      data-convex-url="https://fortunate-dotterel-979.convex.site"
    />
  );
}

/** Subtle footer link that opens the feedback widget. */
export function FeedbackLink({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.FeedbaseWidget?.open?.()}
      className={`cursor-pointer bg-transparent p-0 text-left font-[inherit] text-sm leading-[inherit] text-stone-600 ${className ?? ""}`}
    >
      <MessageCircle className="h-4 w-4" /> Send feedback
    </button>
  );
}
