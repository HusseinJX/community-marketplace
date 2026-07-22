// Cookie-consent state for the advertising pixels (Meta, Google Ads/GA4).
//
// Split of responsibilities:
//   • PostHog = our own first-party product analytics — runs regardless (it
//     powers the app's own funnels/replays, defensible as legitimate interest).
//   • Meta Pixel + Google tags = third-party ad/retargeting — gated on consent.
//
// Google uses Consent Mode v2 (tag loads with everything DENIED by default, then
// flips to GRANTED on accept). Meta only loads at all once consent is granted.
//
// Choice persists in localStorage; components subscribe via onConsentChange.

export type ConsentState = "granted" | "denied";
export const CONSENT_KEY = "wl_consent";
const CHANGE_EVENT = "wl-consent-change";

export function getConsent(): ConsentState | null {
  if (typeof window === "undefined") return null;
  try {
    const v = localStorage.getItem(CONSENT_KEY);
    return v === "granted" || v === "denied" ? v : null;
  } catch {
    return null;
  }
}

export function setConsent(state: ConsentState): void {
  try {
    localStorage.setItem(CONSENT_KEY, state);
  } catch {
    /* private mode — the choice just won't persist */
  }
  try {
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: state }));
  } catch {
    /* no-op */
  }
}

// Subscribe to consent changes (accept/reject clicks). Returns an unsubscribe fn.
export function onConsentChange(cb: (s: ConsentState) => void): () => void {
  const handler = (e: Event) => cb((e as CustomEvent).detail as ConsentState);
  window.addEventListener(CHANGE_EVENT, handler);
  return () => window.removeEventListener(CHANGE_EVENT, handler);
}
