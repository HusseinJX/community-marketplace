"use client";

import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";

// OAuth return for SHOPPER sign-in/sign-up (the custom login modal's web path).
// Unlike /sso-callback (which force-redirects vendors to /join onboarding), this
// completes sign-in OR sign-up and returns the shopper to wherever they were —
// the `redirectUrlComplete` passed to authenticateWithRedirect drives it; the
// fallbacks below only apply if none was set. Kept separate so vendor onboarding
// is untouched.
export default function AccountCallbackPage() {
  return (
    <AuthenticateWithRedirectCallback
      signInFallbackRedirectUrl="/"
      signUpFallbackRedirectUrl="/"
    />
  );
}
