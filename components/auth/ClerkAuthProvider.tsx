"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { ClerkProvider } from "@clerk/nextjs";
import { LoginModal } from "@/components/auth/LoginModal";

// Options for opening the shared shopper login modal.
type LoginOpts = { redirectUrl?: string; title?: string; subtitle?: string };
const LoginOpener = createContext<(o: LoginOpts | null) => void>(() => {});

// Wraps ClerkProvider and mounts the ONE shopper login modal (custom Google/Apple
// screen with the EULA consent line), opened from anywhere via useLogin(). Vendor
// sign-in uses <VendorPhoneLogin> (the same modal, vendor variant) directly.
export function ClerkAuthProvider({ children }: { children: React.ReactNode }) {
  const [login, setLogin] = useState<LoginOpts | null>(null);

  return (
    <ClerkProvider appearance={CLERK_APPEARANCE}>
      <LoginOpener.Provider value={setLogin}>
        {children}
        {login && (
          <LoginModal
            variant="shopper"
            onClose={() => setLogin(null)}
            redirectUrl={login.redirectUrl}
            title={login.title}
            subtitle={login.subtitle}
          />
        )}
      </LoginOpener.Provider>
    </ClerkProvider>
  );
}

// Open the custom shopper login modal. Defaults the post-login redirect to the
// current page so an inline action (save, RSVP, react) returns you where you were.
export function useLogin() {
  const setLogin = useContext(LoginOpener);
  return useCallback(
    (opts?: LoginOpts) => {
      const redirectUrl =
        opts?.redirectUrl ??
        (typeof window !== "undefined"
          ? window.location.pathname + window.location.search
          : "/");
      setLogin({ ...opts, redirectUrl });
    },
    [setLogin]
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
