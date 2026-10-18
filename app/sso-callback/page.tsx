"use client";

import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";

// Landing route for the Google/Apple OAuth redirect started in /join
// (signIn.authenticateWithRedirect). Clerk completes the sign-in here — or, for
// an account that doesn't exist yet, transfers it to a sign-up — sets the
// session, then sends the person back to /join, whose resume effect restores
// the flow from sessionStorage. `continueSignUp` lets an OAuth account finish
// a sign-up that was started with missing fields.
export default function SsoCallbackPage() {
  return (
    <AuthenticateWithRedirectCallback
      signUpForceRedirectUrl="/join"
      signInForceRedirectUrl="/join"
      continueSignUpUrl="/join"
    />
  );
}
