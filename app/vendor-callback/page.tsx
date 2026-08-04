"use client";

import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";

// OAuth return for the VENDOR login popup (LoginModal variant "vendor").
// Unlike /sso-callback — which FORCE-redirects to /join (tuned for the /join
// sign-up popup, whose redirectUrlComplete is also /join) — this uses FALLBACK
// URLs so the popup honors the `redirectUrlComplete` the modal passed (/vendor).
// The force-to-/join on /sso-callback silently broke the vendor popup: the popup
// landed on /join instead of the completion URL, so Clerk never synced the
// session back to the opener and it threw "Couldn't complete sign-in." Keeping a
// separate route leaves /join and /account-callback untouched.
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
