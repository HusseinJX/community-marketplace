"use client";

import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";

// OAuth return for the VENDOR login (LoginModal variant "vendor"), which is a
// full-page redirect on web. Unlike /sso-callback — which FORCE-redirects to
// /join (tuned for the /join sign-up flow, whose redirectUrlComplete is also
// /join) — this uses a FALLBACK sign-in URL so the `redirectUrlComplete` the
// modal passed (/vendor, or wherever the vendor was headed) is honored, while a
// brand-new login is still forced into onboarding. That /join nudge lives HERE,
// not in the modal, so it survives the modal being unmounted by the redirect.
// Keeping a separate route leaves /join and /account-callback untouched.
//   • returning vendor (sign-in) → back to /vendor (via redirectUrlComplete)
//   • brand-new login (sign-up)  → /join onboarding to set up a page
export default function VendorCallbackPage() {
  return (
    <AuthenticateWithRedirectCallback
      signInFallbackRedirectUrl="/vendor"
      signUpForceRedirectUrl="/join"
      continueSignUpUrl="/join"
    />
  );
}
