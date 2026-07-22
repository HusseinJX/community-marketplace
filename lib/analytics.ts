import posthog from "posthog-js";

// One call → all three destinations. Fire this at real conversion moments (sign
// up, claim a business, subscribe, complete checkout, RSVP) so ad platforms can
// optimize + build lookalike audiences and PostHog records the funnel.
//
//   trackConversion("Lead")                       // a standard Meta event
//   trackConversion("Purchase", { value: 30, currency: "USD" })
//   trackConversion("subscribe_pro", {}, { meta: "Subscribe" })  // custom name → mapped Meta event
//
// Meta wants its own event vocabulary (PageView, Lead, Purchase, CompleteRegistration,
// Subscribe…) — pass `map.meta` when our internal name differs. Everything is
// best-effort and consent-aware automatically: window.fbq/gtag only exist after
// the user accepted (see components/analytics/AdPixels), so on reject these are
// simply no-ops. PostHog always records.
export function trackConversion(
  event: string,
  params: Record<string, unknown> = {},
  map: { meta?: string } = {}
): void {
  // PostHog (first-party) — always.
  try {
    posthog.capture(event, params);
  } catch {
    /* never break the app */
  }
  if (typeof window === "undefined") return;
  // Meta Pixel — standard event name if mapped, else a custom event.
  try {
    const w = window as unknown as { fbq?: (...a: unknown[]) => void };
    if (w.fbq) {
      if (map.meta) w.fbq("track", map.meta, params);
      else w.fbq("trackCustom", event, params);
    }
  } catch {
    /* no-op */
  }
  // Google (Ads + GA4) — a gtag event; Ads conversions are configured dashboard-side.
  try {
    const w = window as unknown as { gtag?: (...a: unknown[]) => void };
    w.gtag?.("event", event, params);
  } catch {
    /* no-op */
  }
}
