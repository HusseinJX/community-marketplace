# Insights

Non-obvious things learned building this app — read before touching onboarding,
the iOS shell, or member data.

## Proximity — 2026-08-05
- **A stored place LABEL is not a location.** `posts.location` looked like place data
  ("SoMa", "Mission District") and is not measurable — and for signed-out users it is the
  literal string `"Current location"`, because `/api/places/reverse` is auth-gated to cap
  Google spend. Geocoding those labels was rejected: it returns a **district centroid** and
  would print "0.3 mi away" about a point we invented. The composer already had a real fix
  in hand and was throwing it away; keeping it was the whole fix.
- **`0,0` must be treated as unplaced.** It is what an empty numeric column looks like, and
  a haversine will happily report ~5,000 miles — a confident wrong answer where "unknown"
  was correct. `coordsOf()` rejects it.
- **A distance filter that passes through what it couldn't place is not a filter.** Same bug
  class as the events feed putting a 180-mile event atop a "no car" list. With "Near me" on,
  unplaced records are excluded and the count is *stated* — a silently short list reads as
  "the neighbourhood is empty".
- **Say "no location" rather than nothing.** A blank where a distance sits on every other
  card reads as "nearby". The grey chip only appears once the reader's own position is
  known, which is the only moment the absence means anything.
- **Two single-flight position caches on one screen is still two dialogs.** `home-position`
  (module + localStorage + shared in-flight) and `use-viewer-position` (community chats,
  with its own retry and `?at=` spoof) each deduped themselves and not each other. The chat
  hook now *borrows* a home fix when one exists rather than being merged — the retry and
  spoof semantics are part of a gating mechanic and not worth changing for this.

## Video storage (YouTube) — 2026-08-04
- **The channel is chosen at CONSENT, not by the Cloud project.** The OAuth client only
  identifies the *app* and can live in any project; a refresh token binds to whichever
  channel was picked on the Google screen, and **nothing in the token says which**. Uploads
  landing on the wrong channel is fixed by re-consenting and picking the Brand Account —
  NOT by generating new credentials, which is the natural but wrong assumption.
  `uploadVideo` returns `channelId`/`channelTitle` precisely because the binding is invisible.
- **Private videos cannot be embedded at all.** The privacy check runs on the *viewer*, not
  the embedder, so every visitor gets "This video is private". Unlisted is the only workable
  setting — and its corollary is that **the link IS the access control**: `posts.video_urls`
  is public-but-unindexed. Fine for posts, wrong for anything sensitive.
- **`youtube.upload` can only ever ADD.** Deleting needs `youtube.force-ssl`. A token minted
  before that scope was requested 403s on delete while uploads keep working — a silent
  half-failure.
- **A YouTube delete is not instantly visible.** oembed returned 200 immediately after a
  successful delete and 404 ten seconds later. Don't read an immediate 200 as failure.
- **A `deleted_client` OAuth error is unrecoverable.** Deleting an OAuth client invalidates
  every token it ever issued, so archived credentials cannot be revived by re-consenting.
- **The "API not enabled" error names the project NUMBER, not the id.** Enabling the API on
  the project you assume owns the client is a real way to lose twenty minutes.
- **A YouTube video id is any 11 chars of `[A-Za-z0-9_-]`**, which plenty of ordinary URL
  path segments match (`https://example.com/not-a-video` parsed as the id `not-a-video`).
  Always host-check before extracting an id, or a non-YouTube URL builds a delete call for
  an unrelated video.

## Deletion semantics — 2026-08-04
- **Soft-hide and hard-delete need different media behaviour.** `removePost()` is reversible
  via `restorePost()`, so it must NOT reap the video — reaping would make restore impossible.
  `deleteOwnPost()`/`purgePost()` are irreversible and must reap, because an unlisted video
  outlives its row and stays watchable by link. Deleting the row alone makes "delete" a lie.
- **Enforce ownership inside the DELETE statement** (`.eq('author_id', …)`) rather than
  read-then-check: one round trip, and no window between the check and the delete.
- **"Already gone" is success, not an error.** A repeat delete should report true — the
  caller's intent is "this must not exist".

## Operations — 2026-08-04
- **`supabase db push` HANGS with no password.** `supabase/.temp/pooler-url` carries none, so
  the CLI blocks on a prompt that never arrives without a TTY (it looks exactly like a network
  hang). Port 5432 is unreachable from this machine; 6543 connects but still wants the
  password. The route that needs no DB password: the Management API with the CLI's token from
  the macOS Keychain — see the Key Convention in `CLAUDE.md`. Register the version in
  `supabase_migrations.schema_migrations` afterwards or the history diverges.
- **CapRover's env API REPLACES the whole variable set.** Read the app definition, extend it,
  write it back — never post a partial one, or you silently drop 46 other variables.
- **A `tr_dev_` Trigger.dev key sends everything to DEV**, including env-var writes. That is
  how prod came to look configured while having zero variables, and why a scheduled task would
  have failed every night in silence. Check the environment, not just the dashboard.
- **Deployed runtimes differ from local.** The Trigger.dev worker runs Node 21, which has no
  native WebSocket; `@supabase/supabase-js` builds a Realtime client inside `createClient()`
  and throws without one. Local Node 25 passed with identical code, so it was invisible
  outside the deployed environment. Pin `runtime` explicitly.
- **Scripts importing `lib/posts` fail outside Next** — it pulls in `lib/moderation`, which
  imports `server-only`. Run them with `npx tsx --conditions=react-server`.

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
