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
    <ClerkProvider localization={localization} appearance={CLERK_APPEARANCE}>
      <IntentSetter.Provider value={setIntent}>{children}</IntentSetter.Provider>
    </ClerkProvider>
  );
}

// Brand + mobile-friendly styling for every Clerk surface (the shopper/vendor
// sign-in modal especially). We keep Clerk's default base font size — overriding
// the `fontSize` variable scales the ENTIRE modal (which read as "too zoomed in").
// iOS input-zoom is instead prevented per-field via `formFieldInput`'s `text-base`
// (16px). Taller inputs/buttons give proper touch targets; the card goes
// full-width with safe side margins on small screens instead of a cramped box.
const CLERK_APPEARANCE = {
  variables: {
    colorPrimary: "#7c3aed", // violet-600, matches the app accent
    borderRadius: "0.85rem",
  },
  elements: {
    modalContent: "mx-3 sm:mx-auto",
    card: "w-full max-w-[26rem] rounded-2xl shadow-xl px-5 py-6 sm:px-8",
    headerTitle: "text-xl font-bold",
    headerSubtitle: "text-sm text-stone-500",
    formButtonPrimary: "h-12 text-sm font-semibold normal-case tracking-normal rounded-full",
    formFieldInput: "h-12 text-base rounded-xl",
    formFieldLabel: "text-sm font-medium",
    socialButtonsBlockButton: "h-12 rounded-xl",
    otpCodeFieldInput: "h-12 w-12 text-lg",
    footerActionLink: "font-semibold text-violet-600",
  },
};

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
