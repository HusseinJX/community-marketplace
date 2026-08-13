# Error tracking (Sentry) + analytics (PostHog) — full

## Error Tracking (Sentry) — errors only; PostHog keeps analytics + replay

**The split: Sentry owns errors end to end, PostHog owns product + session replay.** `capture_exceptions`
is now **`false`** in `lib/posthog-provider.tsx` — with both on, one crash filed two unrelated issues in two
dashboards, and PostHog only ever saw the browser half anyway.

**⚠️ THE `Http` FILTER IN `sentry.server.config.ts` IS LOAD-BEARING — deleting it takes the whole site down
about 38 hours later.** `integrations: (defaults) => defaults.filter(i => i.name !== "Http")` is not a
preference. Sentry's `Http` integration wraps `server.emit` in a Proxy and guards against double-wrapping
with a **module-level WeakMap** ("re-wrap only if the current `emit` isn't the one *I* stored") — correct for
one instance of the SDK, useless for two, and this build gets two. Each copy sees the other's proxy as
foreign and re-wraps **on every request**: measured at **+2 proxy layers per request, forever**. Every `emit`
then walks all the layers, so recursion depth grows with lifetime traffic until `RangeError: Maximum call
stack size exceeded` hits every request and the container stops answering. **That is what happened on
2026-08-13** — whatslocal.ai served gateway timeouts ~38h after the v125 deploy, with **CapRover itself
perfectly healthy and the container up but wedged**. Fixed in **v126**.
  - **A restart is not a fix — it only resets the depth to zero** and buys another day and a half. If the
    site times out and `captain.whatslocal.ai` is fine, this is the first thing to check.
  - **Deduplicating the SDK does NOT work; don't re-run that experiment.** It is the **ESM/CJS dual-package
    hazard inside `node_modules`**, not our bundling — with `serverExternalPackages` and **zero** copies
    bundled into the server output, a 2,000-request burst *still* produced 1,014 overflows. Worse,
    externalising **`@sentry/nextjs`** or **`@sentry/server-utils`** kills the server on **boot** ("Cannot
    find module meriyah"): Next's file tracing can't follow them into the standalone output, so every
    request 500s. Both were tested; both took the site down.
  - **Verify only with a BURST** — ~2,000 *concurrent* requests at the standalone build, then grep the log
    for "Maximum call stack". A few hundred serial requests passes while still broken; that false green is
    why this looked fixed twice before it was.
  - **What the filter costs:** no incoming-request spans, no per-request isolation scope. **Errors are
    unaffected** — `onRequestError` still reports throws in route handlers, server components and server
    actions (re-verified against a local sink with the filter on). Tracing is sampled at 0.1 and secondary;
    the site staying up is not.
  - **The DSN is baked in at BUILD time** via `NEXT_PUBLIC_SENTRY_DSN`, so unsetting `SENTRY_DSN` on
    CapRover does **not** turn server Sentry off. Don't reach for that as a mitigation.

- **Server (the reason this exists):** `instrumentation.ts` → `register()` loads `sentry.server.config.ts`
  (node) or `sentry.edge.config.ts` (edge — **required separately**, `middleware.ts`/clerkMiddleware runs
  there and the Node SDK cannot load in it). `export const onRequestError = Sentry.captureRequestError`
  is the hook that catches throws in route handlers, server components and server actions. **Verified**
  2026-08-10 against a local sink: a real throw in a route produced an `event` envelope.
- **Client:** `instrumentation-client.ts` (Next 16 convention — runs before the app is interactive, so it
  catches a crash during first paint that a React provider would miss) + `onRouterTransitionStart`.
  **Verified** the same way.
- **The PostHog link:** `beforeSend` attaches `contexts.posthog.session_replay` — the replay URL with a
  timestamp offset — so a Sentry issue opens the recording of the person who hit it. It **must import
  `posthog` as a module**, not read `window.posthog`: the app imports posthog-js, the global is not set,
  and reading it silently attached nothing (caught only because it was tested against a sink).
- **NO Sentry Session Replay, deliberately.** PostHog already records, and its recorder is the one carrying
  our `data-private` masking. A second rrweb would double script weight inside the iOS WKWebView *and*
  capture the conversation text we deliberately mask.
- **Trigger.dev worker is a SEPARATE deploy target** (`trigger/sentry.ts`, `@sentry/node`, registered via
  `tasks.onFailure` — `config.onFailure` is deprecated). Instrumenting Next.js does nothing for it, and it
  has the worst track record in the repo (the nightly sweep failed for weeks in silence). It fires only
  after retries are exhausted, and `flush(2000)`s because the runtime exits the moment a run settles.
  **`SENTRY_DSN` must be set on the Trigger.dev PROD environment** — a `tr_dev_` key in `.env.local` means
  everything you set from this machine lands in DEV. **DONE 2026-08-10**, and the worker was redeployed as
  **v20260810.1** (4 tasks) so the hook actually reaches prod — setting the env var alone changes nothing
  until a deploy. **`npm run trigger:deploy` pins the CLI to the installed SDK (4.4.6)**: `@latest` aborts
  with "Version mismatch detected while running in CI", and upgrading the SDK to match would be a change
  to a pipeline whose version is currently known-good. Re-confirmed on this deploy: the composio
  `sync-all-catalogs` cron is still commented out and did NOT switch on as a side effect.
- **Everything no-ops without a DSN**, including the build: `withSentryConfig` skips source-map upload with
  no `SENTRY_AUTH_TOKEN`, which matters because this build is also an App Store release and a missing
  analytics token must never block a deploy.
- **`tunnelRoute: "/monitoring"` — VERIFIED 2026-08-10** with the real DSN: the browser posted 4 envelopes
  to `localhost:3000/monitoring?o=…&p=…&r=us`, all `200`, and **nothing** direct to `ingest.us.sentry.io`.
  Note it engages **only for a real sentry.io DSN** — against a fake local DSN the client posts straight to
  the DSN host, which is what made this look broken during wiring. Same anti-ad-blocker reasoning as
  PostHog's `/ingest`.
- `disableLogger` is deliberately **not** set: the SDK deprecates it for
  `webpack.treeshake.removeDebugLogging`, which its own warning says is unsupported with Turbopack — which
  is what this project builds with.
