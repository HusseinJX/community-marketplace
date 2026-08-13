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
    // THIS FILTER KEEPS THE SITE UP. Removing it takes production down about a
    // day and a half later, which is exactly how it was found (2026-08-13:
    // whatslocal.ai serving gateway timeouts, ~38h after the v125 deploy).
    //
    // The `Http` integration wraps `server.emit` in a Proxy to isolate incoming
    // requests. It guards against double-wrapping with a module-level WeakMap:
    // it re-wraps only when the server's current `emit` is not the one *it* last
    // stored. That guard is correct for one instance of the SDK and useless for
    // two — and this build ends up with two. Each copy sees the other's proxy as
    // "not mine" and re-wraps on EVERY request: measured at +2 proxy layers per
    // request, forever. Every emit then walks the whole stack of layers, so
    // recursion depth grows with lifetime traffic until
    // `RangeError: Maximum call stack size exceeded` hits every request and the
    // container stops answering. A restart only resets the depth to zero.
    //
    // Deduplicating the SDK was tried first and does NOT work: it is the ESM/CJS
    // dual-package hazard inside node_modules, not our bundling, so even with
    // zero copies bundled into the server output a 2,000-request burst still
    // produced 1,014 stack overflows. Dropping the integration removes the Proxy
    // altogether, which makes the recursion structurally impossible however many
    // copies exist (verified: `server.emit` is wrapped 0 times).
    //
    // What this costs: no spans for incoming requests, and no per-request
    // isolation scope. What it does NOT cost is the thing this file exists for —
    // errors. `onRequestError` in instrumentation.ts still reports every throw
    // in a route handler, server component and server action, and the global
    // uncaught/unhandled handlers are untouched. Tracing was already sampled at
    // 0.1 and described above as secondary; the site staying up is not.
    //
    // Revisit only with a burst test (~2,000 concurrent requests against the
    // standalone build, grep the log for "Maximum call stack"). A handful of
    // serial requests passes while still being broken — that false green is why
    // this looked fixed twice before it was.
    integrations: (defaults) => defaults.filter((i) => i.name !== "Http"),
  });
}
