"use client";

import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";

// Landing route for the Google/Apple OAuth flow started in /join (and anywhere
// else that calls authenticateWithPopup / authenticateWithRedirect). Clerk opens
// this inside the popup, completes the sign-up/sign-in, sets the session on the
// shared client, then closes the popup — the opener's promise resolves and the
// onboarding flow picks up where it left off. `continueSignUp` lets an OAuth
// account finish a sign-up that was started with missing fields.
export default function SsoCallbackPage() {
  return (
    <AuthenticateWithRedirectCallback
      signUpForceRedirectUrl="/join"
      signInForceRedirectUrl="/join"
      continueSignUpUrl="/join"
    />
  );
}
