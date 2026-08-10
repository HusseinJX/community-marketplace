// Next 16 server instrumentation (node_modules/next/dist/docs → 01-app →
// file-conventions/instrumentation.md). `register()` runs once per server
// instance before any request is handled; `onRequestError` fires for every
// server-side throw Next catches.
//
// The runtime split is required, not tidiness: middleware runs on the edge
// runtime, which cannot load the Node SDK.

import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// The one hook that catches what nothing else did: errors thrown inside route
// handlers, server components and server actions. Sentry's own helper matches
// the signature Next documents, and no-ops when no DSN was configured.
export const onRequestError = Sentry.captureRequestError;
