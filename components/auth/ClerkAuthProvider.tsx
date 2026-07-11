"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { ClerkProvider, useClerk } from "@clerk/nextjs";

// Which side is being logged into, so the shared Clerk modal can label itself
// ("Signing in as a shopper" vs "as a vendor"). It's one Clerk account under the
// hood — this is just contextual copy driven by which button was pressed.
type Intent = "shopper" | "vendor" | null;

const IntentSetter = createContext<(i: Intent) => void>(() => {});

const SIGN_IN_SUBTITLE: Record<"shopper" | "vendor", string> = {
  shopper: "Signing in as a shopper",
  vendor: "Signing in as a vendor",
};

// Wraps ClerkProvider so the sign-in modal's copy can change per login button.
export function ClerkAuthProvider({ children }: { children: React.ReactNode }) {
  const [intent, setIntent] = useState<Intent>(null);

  const localization = useMemo(
    () => ({
      signIn: {
        start: {
          title: "Sign in to WhatsLocal",
          subtitle: intent ? SIGN_IN_SUBTITLE[intent] : "Welcome back to WhatsLocal",
        },
      },
      signUp: {
        start: {
          title:
            intent === "vendor"
              ? "Set up your WhatsLocal vendor account"
              : "Create your WhatsLocal account",
          subtitle: intent === "vendor" ? "Signing up as a vendor" : "Welcome to WhatsLocal",
        },
      },
    }),
    [intent]
  );

  return (
    <ClerkProvider localization={localization}>
      <IntentSetter.Provider value={setIntent}>{children}</IntentSetter.Provider>
    </ClerkProvider>
  );
}

// Open the Clerk sign-in modal, tagged with which side you're logging into so
// the modal reads "Signing in as a shopper / vendor". Vendors sign up through
// the /join onboarding flow, not Clerk — so the modal's "Don't have an account?
// Sign up" footer is hidden for vendors and only shown to shoppers.
export function useOpenLogin() {
  const setIntent = useContext(IntentSetter);
  const clerk = useClerk();
  return useCallback(
    (intent: "shopper" | "vendor", opts?: Parameters<typeof clerk.openSignIn>[0]) => {
      setIntent(intent);
      const hideSignUp =
        intent === "vendor"
          ? { appearance: { elements: { footerAction: { display: "none" } } } }
          : {};
      clerk.openSignIn({ ...hideSignUp, ...opts });
    },
    [setIntent, clerk]
  );
}
