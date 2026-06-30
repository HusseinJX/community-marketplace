# Insights

Non-obvious things learned building this app — read before touching onboarding,
the iOS shell, or member data.

## Architecture / data ownership
- **Members live in the connector-agent, not here.** This app *reads* members via
  `lib/api.ts` (`marketplace-members`/`marketplace-member`) and historically could only
  *claim* harvested listings. Creating a brand-new business **must** go through a connector
  function — that's why this session added `marketplace-create-member` + `marketplace-onboard`
  there. Anything that "creates a member" locally would not appear on profile pages or in
  search, because those read the connector.
- **The connector is the profiling brain.** `chat.js` uses `buildSystemPrompt` + `parseCompletion`
  (in `netlify/functions/lib/`) to turn a conversation into a ~45-field profile + Pinecone
  vectors. `marketplace-onboard` reuses that over a full transcript in one shot — so QR
  onboarding produces members identical to SMS/web onboarding. Don't reimplement profiling here.
- **Hybrid onboarding chat:** the booth conversation UI is in *this* app (resilient, owns
  event-tagging); only the final profiling hits the connector. Keeps a noisy-market booth
  from depending on the connector per keystroke.

## iOS shell (whatslocal-ios)
- **The iOS app loads the hosted Netlify site** via `capacitor.config.ts` `server.url`
  (`comfy-zuccutto-73b27f.netlify.app`) — it does **not** bundle the web app. So web changes
  reach the phone via a **Netlify redeploy**, NOT `cap sync`/Xcode rebuild. This is why "I see
  the old version on my phone" = stale Netlify deploy.
- **Web NFC (`NDEFReader`) does not exist on iOS** (WKWebView/Safari) — Chrome-Android only.
  Native iPhone NFC requires **Core NFC** via a Capacitor plugin. The web layer calls it through
  the injected `window.Capacitor.Plugins.Nfc` (no need to import the plugin's JS into the hosted
  bundle — native registration exposes it on the bridge).
- **Capacitor 8 uses SPM, not CocoaPods.** `CapApp-SPM/Package.swift` + `packageClassList` (in the
  generated `capacitor.config.json`) are **CLI-managed** — add plugins via a package + `cap sync`,
  don't hand-edit. A local plugin package (`local-plugins/capacitor-nfc/`) installed with
  `npm install ./path` + `npx cap sync ios` wires both automatically.
- **Core NFC needs the paid Apple Developer Program** + the NFC capability + a **physical device**
  (no Simulator). Don't add the capability while enrollment is "pending" — with Automatic signing
  it breaks provisioning and blocks the whole app from running.

## Deploy safety
- **Two different dynamic slug names at the same route level crash the whole app.**
  `app/events/[id]` + `app/events/[eventId]` (or `app/api/events/[memberId]` + `[eventId]`)
  → Next.js fails the entire route tree (`'eventId' !== 'id'`) and **every** route 500s at
  startup. tsc/eslint do NOT catch this — only a running server does. Took the live site down
  once (2026-06-28). Always reuse the existing slug name under a given parent, or put the new
  route on a non-conflicting path / move the id into the request body.
- **Run a local prod build + smoke test before `netlify deploy --build --prod`.** `npm run build`
  then `npx next start -p 3010` and curl `/`, `/vendor`, etc. — route-config and bundling errors
  pass type-check but break the server. Rollback if needed: `netlify api restoreSiteDeploy
  --data '{"site_id":"…","deploy_id":"<previous-ready-deploy>"}'` (find ids via
  `netlify api listSiteDeploys`).

## Demo mode
- **`resolveActor` has no demo path → demo writes 401.** Vendor *write* APIs (giving, network,
  organize, onboard, facets) need real Clerk auth + a linked `vendor_profiles` row.
- **Gated vendor pages render in demo** via `lib/demo-server.ts` `demoMemberId()` (maps the
  demo-type cookie → a `demo-*` member). So the UIs *show* in demo even though writes no-op.
- The Supabase **xeno project auto-pauses** (free tier, ~7 days idle) — that surfaces as DB
  connection timeouts everywhere. Restore it in the dashboard before any DB op / it also
  degrades the live app's DB-backed features.

## Layout / overflow
- **`min-w-0` goes on the flex/grid CHILD that holds text, not just its inner wrapper.**
  Flex/grid items default to `min-width: auto` (= min-content), so a card with text grows
  past the screen and causes horizontal overflow even if an inner div has `min-w-0`. Fix:
  put `min-w-0` on the item itself. Also `truncate` only works on block/inline-block
  elements — an inline `<Link>`/`<a>` with `truncate` won't constrain (use `block truncate`).
  Diagnose live with the browse tool: compare `document.documentElement.scrollWidth` vs
  `clientWidth` at a phone width and list elements wider than the viewport.

## Conventions / gotchas
- **`resolveActor` has no demo-mode path** — it needs real Clerk auth + a linked `vendor_profiles`
  row. So vendor *write* features (giving, network, organize, onboard, facets) return 401 in
  `NEXT_PUBLIC_DEMO_MODE`; the UI is browsable but writes need a real signed-in vendor. Same
  limitation as the existing Go Live composer.
- **New feature tables need explicit grants.** Every migration this session grants
  `anon, authenticated, service_role` + an open RLS policy — vendor write paths use the **anon**
  key (`lib/vendor-connect.ts`), so without grants writes silently fail.
- **ESLint `react-hooks/set-state-in-effect`** is enforced and will fail builds. Calling `setState`
  synchronously in a `useEffect` body trips it — compute during render (or in the async `.then`)
  instead. Bitten twice this session (NFC support check, join-link URL). Note: `app/page.tsx` and
  `EventActionBar.tsx` already carry pre-existing violations of this rule — they're not yours.
- **Profile pages are server components**; `resolveActor(id)` there cheaply gates owner/admin-only
  inline editors (e.g. the facet editor) — anonymous viewers short-circuit fast.
- **Per-entity "self-hiding" components** (MemoriesGrid, GivesBackBadges, BusinessFacets) fetch
  client-side and render `null` when empty, so they're safe to drop on every profile incl. demo.
- **Self-join vs organizer-invite** in `collab_invites`: a row with `from_id === to_id` marks a
  self-join (vendor requested to join) → organizer approves; otherwise the organizer invited and
  the vendor accepts. Same table, opposite approval direction.
