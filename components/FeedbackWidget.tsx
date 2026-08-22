"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import { useUser } from "@clerk/nextjs";
import { MessageCircle } from "lucide-react";
import { LoginModal } from "@/components/auth/LoginModal";

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

/**
 * Subtle footer link that opens the feedback widget — for a signed-in person.
 *
 * Signed out, it asks them to sign in first rather than opening the form. Two
 * reasons, and the second is the real one:
 *
 *  - Anonymous feedback is close to unusable. Nobody can be told their bug is
 *    fixed, nothing can be asked back, and a board full of "Anonymous" is a
 *    board nobody triages.
 *  - The name field is hidden now (see globals.css) precisely because the
 *    signed-in name is already attached. Hiding it while still letting a
 *    signed-out person submit would post every one of those as "Anonymous"
 *    with no way for them to say otherwise — worse than what was there before.
 *
 * The gate is on OPENING, not on the button: a disabled-looking link that says
 * nothing teaches nobody. They see the ask, then the reason.
 */
export function FeedbackLink({ className }: { className?: string }) {
  const { isSignedIn, isLoaded } = useUser();
  const [login, setLogin] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          // Still loading: treat as signed out rather than opening a form that
          // would submit anonymously a moment before we knew better.
          if (isLoaded && isSignedIn) window.FeedbaseWidget?.open?.();
          else setLogin(true);
        }}
        className={`cursor-pointer bg-transparent p-0 text-left font-[inherit] text-sm leading-[inherit] text-stone-600 ${className ?? ""}`}
      >
        <MessageCircle className="h-4 w-4" /> Send feedback
      </button>

      {login && (
        <LoginModal
          onClose={() => setLogin(false)}
          title="Sign in to send feedback"
          subtitle="So we can tell you when it's fixed, and ask you about it if we need to."
        />
      )}
    </>
  );
}
