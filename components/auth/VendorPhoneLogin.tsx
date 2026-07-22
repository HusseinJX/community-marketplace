"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useClerk } from "@clerk/nextjs";
import { X, Loader2, ArrowRight } from "lucide-react";
import { GoogleIcon, AppleIcon } from "@/components/auth/OAuthBrandIcons";
import { isNativeApp } from "@/lib/native";
import { nativeGoogleSignIn } from "@/lib/native-auth";

// Vendor login. Accounts are email-based via Google or Apple only — email is our
// channel for account/notification updates (we don't send account SMS). Phone is
// used solely to VERIFY a business (the ownership OTP in /join), never to sign
// in. (Filename kept for import stability.)
export function VendorPhoneLogin({
  onClose,
  redirectUrl = "/vendor",
}: {
  onClose: () => void;
  redirectUrl?: string;
}) {
  const clerk = useClerk();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [noAccount, setNoAccount] = useState(false);

  // Log in with Google / Apple. On the web a popup + /sso-callback keeps this
  // modal mounted. In the iOS app the popup is blocked, so: Apple → oauth_apple
  // REDIRECT kept inside the webview (native token strategy 401s from the web
  // SDK); Google → native plugin token.
  async function oauthLogin(strategy: "oauth_google" | "oauth_apple") {
    setErr("");
    setNoAccount(false);
    setBusy(true);
    if (isNativeApp()) {
      if (strategy === "oauth_apple") {
        try {
          await clerk.client.signIn.authenticateWithRedirect({
            strategy: "oauth_apple",
            redirectUrl: `${window.location.origin}/sso-callback`,
            redirectUrlComplete: `${window.location.origin}${redirectUrl}`,
          });
          // Redirect navigates away; nothing after this runs.
        } catch (e) {
          setBusy(false);
          setErr(e instanceof Error ? e.message : "Couldn't start Apple sign-in.");
        }
        return;
      }
      try {
        await nativeGoogleSignIn(clerk);
        router.push(redirectUrl);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Couldn't sign in with that provider.");
      } finally {
        setBusy(false);
      }
      return;
    }
    const popup = window.open("", "_blank", "width=520,height=640");
    try {
      await clerk.client.signIn.authenticateWithPopup({
        strategy,
        redirectUrl: `${window.location.origin}/sso-callback`,
        redirectUrlComplete: `${window.location.origin}${redirectUrl}`,
        popup,
      });
      if (!clerk.session) throw new Error("Couldn't complete sign-in. Make sure the popup wasn't blocked.");
      router.push(redirectUrl);
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
          <h2 className="text-lg font-semibold text-stone-900">Vendor login</h2>
          <button onClick={onClose} aria-label="Close">
            <X className="h-5 w-5 text-stone-400" />
          </button>
        </div>
        <p className="mt-1 text-sm text-stone-500">
          Sign in the same way you set up your page — with Google or Apple.
        </p>

        {err && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{err}</p>}
        {noAccount && (
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
      </div>
    </div>
  );
}
