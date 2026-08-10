// Sentry — browser. Runs before the app becomes interactive (Next 16
// `instrumentation-client.ts`), which is what lets it catch a crash during the
// first paint that a React-mounted provider would miss.
//
// Two deliberate omissions:
//
//   1. NO Sentry Session Replay. PostHog already records sessions, and its
//      recorder is the one carrying our `data-private` masking rules. A second
//      rrweb recorder would double the script weight inside the iOS WKWebView
//      and capture the conversation text we deliberately mask — for a replay we
//      already have. Instead, every Sentry event is tagged with the PostHog
//      replay URL below, so an issue links to the session that caused it.
//   2. NO tracing integrations beyond the default sample. Performance lives in
//      PostHog; this is an error reporter.

import * as Sentry from "@sentry/nextjs";
import posthog from "posthog-js";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    tracesSampleRate: Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
    sendDefaultPii: false,
    beforeSend(event) {
      // The bridge to PostHog: a Sentry issue is a stack trace, a PostHog replay
      // is thirty seconds of the person tapping the thing that broke.
      //
      // Imported as a MODULE, not read off `window.posthog`. The app does
      // `import posthog from "posthog-js"`, and reading the global found nothing
      // — verified against a local sink, where the context never attached. Same
      // module instance the provider initialises, so no extra bundle weight.
      //
      // Called defensively: this runs before the app mounts, so PostHog may not
      // be initialised yet and the helpers return undefined. Analytics is never
      // allowed to cost us an error report.
      try {
        const url = posthog.get_session_replay_url?.({ withTimestamp: true });
        if (url) {
          event.contexts = {
            ...event.contexts,
            posthog: { session_replay: url, distinct_id: posthog.get_distinct_id?.() },
          };
        }
      } catch {
        /* no-op */
      }
      return event;
    },
  });
}

// Lets Sentry tie an error to the navigation that was in flight when it threw.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
