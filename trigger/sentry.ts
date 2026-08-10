// Sentry for the Trigger.dev worker.
//
// This is a SEPARATE deploy target from the web app: `npm run trigger:deploy`
// ships this code to Trigger.dev's own infrastructure, and instrumenting
// Next.js does nothing for it. It also has the worst track record in the repo —
// the nightly event sweep failed every night for weeks because the worker had
// no env vars in prod, and nothing anywhere said so. A run that dies here is
// invisible unless you go and look at the dashboard.
//
// Node SDK, not the Next.js one: there is no Next.js here.
//
// Needs SENTRY_DSN set on the Trigger.dev PROD environment specifically. The
// hard-won lesson from that outage: `tr_dev_` keys in .env.local mean anything
// you set from this machine lands in DEV. Check the environment, not just the
// dashboard.

import * as Sentry from "@sentry/node";
import { tasks } from "@trigger.dev/sdk";

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.TRIGGER_ENVIRONMENT || process.env.NODE_ENV,
    // No tracing on a batch worker — a nightly sweep is not a latency budget.
    tracesSampleRate: 0,
    sendDefaultPii: false,
  });
}

// Global hook: fires once a run has exhausted its retries, so a transient blip
// that the third attempt recovers from does not page anyone. `tasks.onFailure`
// rather than `config.onFailure`, which the SDK deprecates.
tasks.onFailure(async ({ payload, error, ctx }) => {
  if (!dsn) return;
  Sentry.withScope((scope) => {
    scope.setTag("trigger.task", ctx.task.id);
    scope.setTag("trigger.run", ctx.run.id);
    scope.setContext("trigger", {
      taskId: ctx.task.id,
      runId: ctx.run.id,
      startedAt: ctx.run.startedAt,
      isTest: ctx.run.isTest,
      payload,
    });
    Sentry.captureException(error);
  });
  // Flush before the runtime is torn down — a serverless-style worker exits the
  // moment the run settles, and an unflushed event is a lost one.
  await Sentry.flush(2000);
});
