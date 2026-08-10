// Sentry — server runtime (Node). Loaded from instrumentation.ts `register()`.
//
// This is the half that matters. PostHog's `capture_exceptions` is posthog-js,
// so it only ever saw the browser: a throw in an API route, a Stripe or Uber
// webhook, a server component, or the nightly event sweep went to the CapRover
// container log and nowhere else. That is not a hypothetical gap — the events
// sweep failed every night for weeks in exactly that silence.
//
// No DSN = no-op, matching every other integration in this app (Uber, Composio,
// Resend, APNs). Nothing here can break a request when it is unconfigured.

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    // Errors are the job. Tracing is a separate (metered) product and this app
    // already measures what it cares about in PostHog, so it is sampled low and
    // exists mainly to give an error a request to sit in.
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
    // Off deliberately. `true` attaches IPs, cookies and request bodies to every
    // event — and the bodies here are checkout payloads, chat transcripts and
    // onboarding interviews. We just spent a session keeping that content out of
    // session replay; there is no sense posting it to a second vendor.
    sendDefaultPii: false,
    // Quiet in local dev unless someone deliberately sets a DSN there.
    debug: false,
  });
}
