"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useClerk } from "@clerk/nextjs";
import { X, Loader2, ArrowRight } from "lucide-react";
import { GoogleIcon, AppleIcon } from "@/components/auth/OAuthBrandIcons";
import { isNativeApp } from "@/lib/native";
import { nativeGoogleSignIn } from "@/lib/native-auth";

// The one login modal for the whole app — Google / Apple only, with the EULA
// consent line shown before sign-in (App Store 1.2). Two variants:
//   • "vendor"  — sign-in only; a brand-new login is nudged to /join onboarding.
//                 Web uses a popup (keeps the page mounted).
//   • "shopper" — sign-in OR sign-up; a new login just creates the account.
//                 Web redirects through /account-callback (which handles both and
//                 returns to `redirectUrl`); native uses the token plugins, which
//                 also create the account. No /join nudge.
// Accounts are email-based via Google/Apple only — phone is business-verification
// only, never a sign-in method.
export function LoginModal({
  onClose,
  variant = "shopper",
  redirectUrl,
  title,
  subtitle,
}: {
  onClose: () => void;
  variant?: "shopper" | "vendor";
  redirectUrl?: string;
  title?: string;
  subtitle?: string;
}) {
  const clerk = useClerk();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [noAccount, setNoAccount] = useState(false);

  const isVendor = variant === "vendor";
  const dest = redirectUrl ?? (isVendor ? "/vendor" : "/");
  const heading = title ?? (isVendor ? "Vendor login" : "Sign in to WhatsLocal");
  const blurb =
    subtitle ??
    (isVendor
      ? "Sign in the same way you set up your page — with Google or Apple."
      : "Save spots, RSVP to events, and message local businesses.");

  async function oauthLogin(strategy: "oauth_google" | "oauth_apple") {
    setErr("");
    setNoAccount(false);
    setBusy(true);

    // In the iOS app, popups/redirects to Google are blocked, so both variants
    // use the native token plugins (which create the account for new users).
    if (isNativeApp()) {
      if (strategy === "oauth_apple") {
        try {
          // Shoppers return via /account-callback (back to `dest`); vendors via
          // /sso-callback (which nudges a brand-new login into /join onboarding).
          await clerk.client.signIn.authenticateWithRedirect({
            strategy: "oauth_apple",
            redirectUrl: `${window.location.origin}${isVendor ? "/sso-callback" : "/account-callback"}`,
            redirectUrlComplete: `${window.location.origin}${dest}`,
          });
        } catch (e) {
          setBusy(false);
          setErr(e instanceof Error ? e.message : "Couldn't start Apple sign-in.");
        }
        return;
      }
      try {
        await nativeGoogleSignIn(clerk);
        router.push(dest);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Couldn't sign in with that provider.");
      } finally {
        setBusy(false);
      }
      return;
    }

    // Web SHOPPER: full redirect through /account-callback, which completes a
    // sign-in OR a new sign-up and returns to `dest`.
    if (!isVendor) {
      try {
        await clerk.client.signIn.authenticateWithRedirect({
          strategy,
          redirectUrl: `${window.location.origin}/account-callback`,
          redirectUrlComplete: `${window.location.origin}${dest}`,
        });
      } catch (e) {
        setBusy(false);
        setErr(e instanceof Error ? e.message : "Couldn't sign in with that provider.");
      }
      return;
    }

    // Web VENDOR: popup keeps this modal mounted; a brand-new login has no page
    // yet, so we nudge to /join instead of auto-creating.
    const popup = window.open("", "_blank", "width=520,height=640");
    try {
      await clerk.client.signIn.authenticateWithPopup({
        strategy,
        // /vendor-callback uses FALLBACK redirects so the popup honors this
        // redirectUrlComplete (/vendor). /sso-callback FORCE-redirects to /join,
        // which broke this popup's completion handshake — see that route's note.
        redirectUrl: `${window.location.origin}/vendor-callback`,
        redirectUrlComplete: `${window.location.origin}${dest}`,
        popup,
      });
      if (!clerk.session) throw new Error("Couldn't complete sign-in. Make sure the popup wasn't blocked.");
      router.push(dest);
    } catch (e) {
      try { popup?.close(); } catch {}
      const msg = e instanceof Error ? e.message : "";
      if (/couldn.?t find|not found|no account|identifier|single session/i.test(msg)) {
        setNoAccount(true);
        setErr("No account for that login yet.");
      } else {
        setErr(/cancel|closed|abort/i.test(msg) ? "Sign-in was cancelled." : msg || "Couldn't sign in with that provider.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-stone-900">{heading}</h2>
          <button onClick={onClose} aria-label="Close">
            <X className="h-5 w-5 text-stone-400" />
          </button>
        </div>
        <p className="mt-1 text-sm text-stone-500">{blurb}</p>

        {err && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{err}</p>}
        {noAccount && isVendor && (
          <a
            href="/join"
            className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-violet-700 hover:text-violet-900"
          >
            Set up your page <ArrowRight className="h-4 w-4" />
          </a>
        )}

        <div className="mt-4 space-y-2">
          <button
            onClick={() => oauthLogin("oauth_google")}
            disabled={busy}
            className="inline-flex w-full items-center justify-center gap-2.5 rounded-full border border-stone-300 bg-white px-4 py-3 text-sm font-semibold text-stone-800 hover:bg-stone-50 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleIcon />} Continue with Google
          </button>
          <button
            onClick={() => oauthLogin("oauth_apple")}
            disabled={busy}
            className="inline-flex w-full items-center justify-center gap-2.5 rounded-full bg-black px-4 py-3 text-sm font-semibold text-white hover:bg-stone-800 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <AppleIcon />} Continue with Apple
          </button>
        </div>

        {/* EULA agreement presented before sign-in (App Store 1.2). The Terms
            include the zero-tolerance clause for objectionable content/abuse. */}
        <p className="mt-4 text-center text-[11px] leading-snug text-stone-400">
          By continuing you agree to our{" "}
          <a href="/terms" target="_blank" rel="noreferrer" className="underline hover:text-stone-600">
            Terms of Use
          </a>{" "}
          — which prohibit objectionable content and abusive behavior — and our{" "}
          <a href="/privacy" target="_blank" rel="noreferrer" className="underline hover:text-stone-600">
            Privacy Policy
          </a>
          .
        </p>
      </div>
    </div>
  );
}
