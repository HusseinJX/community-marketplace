// Sentry — edge runtime. `middleware.ts` (clerkMiddleware) runs here, so without
// this file a middleware throw is invisible even once the server side is wired.
//
// Same DSN, same no-op-when-unset rule as sentry.server.config.ts.

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
    sendDefaultPii: false,
  });
}
