# Changelog

All notable changes to this project are documented here.

## [Unreleased] — commerce, live, social shell (branch `feat/collab-rooms`)

> **Deployed to CapRover prod 2026-08-04** (two deploys): the event-feed/tab work, the
> scraped-draft review queue, and video upload + delete + moderator purge are all live on
> `whatslocal.ai`. Verified each time: `/vendor` 307 → `/vendor/sign-in` (demo mode off),
> ad pixels still inert (`fbq`/`gtag` undefined — the ATT statement to App Review stays
> true), 0 console errors. No native change, so no Xcode rebuild was needed.

> **Deployed to CapRover prod 2026-08-10**: the image-forward cards + reordered home header,
> the session-replay masking, and Sentry (client + server + edge). Gates re-run and all passed —
> `/vendor` **307 → /vendor/sign-in** (demo mode off), `pk_live` baked with no real `pk_test` key
> in the bundle (the `pk_test_` string that shows up is Clerk's own prefix constant), **0** `.map`
> files in `.next/static`, and 1,742 source-map files uploaded to Sentry. Verified live afterwards:
> home 200, `/vendor` 307, a real thrown error on `whatslocal.ai` reported through the
> `/monitoring` tunnel (200), and `data-private` present on the assistant chat and absent on Shop
> — masking where conversations are, nowhere else. No native change, so no Xcode rebuild.

> **Deployed to CapRover prod 2026-08-11**: semantic personalisation. Gate re-run and passed —
> `/vendor` **307 → /vendor/sign-in** (demo mode off), home 200. Verified live on `whatslocal.ai`
> afterwards with a full round trip: a feed with no profile returned generic events, saving a
> profile (`hasVector: true`) flipped the same request to `semantic: true` / `usedTaste: true` and
> returned *Lunch at the Library · Social: Game Night · Crafternoon*, then the test profile was
> deleted. Trigger.dev worker redeployed as **v20260812.1** so `embedNew()` runs in the nightly
> sweep — still **4 tasks**, i.e. the commented-out composio `sync-all-catalogs` cron did NOT switch
> on as a side effect. No native change, so no Xcode rebuild.
>
> *Gotcha worth remembering: `pkill -f "next start"` does NOT kill the server — the process is named
> `next-server`. A stale one survived a rebuild underneath it and 404'd the new routes, which looked
> exactly like a broken build. Use `lsof -ti:PORT | xargs kill -9`.*

### Fixed — the save star was missing from the feed the index actually opens on — 2026-08-11
- `SaveEventButton` was on the What's-on cards, the Feed cards and the event page — but **not on the
  For-you cards**, which is what `/` renders by default. So the star was on every events surface
  except the one most people see first.
- Added in both card shapes: **top-LEFT overlay** on the poster (the badges own top-right), and in
  the badge row for **posterless** cards — an event you can't save because it happens to have no
  picture is the worse bug.
- `SaveEventButton` gained a `corner` prop instead of taking `left-2` through `className`. Both set
  the same CSS property, so which one won would have depended on the order Tailwind emitted them in:
  a silent, layout-dependent coin flip.
- **Saving stays a pure bookmark and does NOT feed the taste embedding** — deliberate. A star that
  quietly reshaped your feed would be exactly the invisible-recommender behaviour the taste profile
  is built to avoid; teaching it is what "Remember this" and the `/shopper` editor are for.
- Verified in a browser: star renders on all 60 cards, clicking it does **not** navigate or expand
  the card (the card is one big click target, so `stopPropagation` is the thing that breaks first),
  and signed-out it opens the sign-in sheet. *Caveat: every event in the live feed currently has a
  poster, so the posterless branch was verified by unhiding that row in the DOM, not from real data.*

### Added — semantic personalisation: the events feed matches meaning, and remembers you — 2026-08-11
- **The embedding pipeline already existed and was DEAD CODE.** `lib/reco/embed.ts` was complete,
  `lib/reco/profile.ts` defined a whole `ShopperProfile`, and `rank.ts` had accepted a `profileVector`
  since day one — with exactly one caller, `scripts/try-personas.ts`, reading a 23MB JSON on one laptop.
  That script is what produced the "One feed, six people" artifact on Aug 2. **Production meanwhile ranked
  on literal word overlap** (`keywordScore`) and stored **nothing** about any shopper. This wires it in.
- **Migration `20260811140000`** (applied + registered): pgvector, `vendor_events.embedding vector(1536)`
  + `embed_model`, a `shopper_taste` table, and an `event_similarity()` SQL function.
- **Backfilled 697 events for $0.0009** — 323 replayed **free** from the prototype's own `embeddings.json`,
  374 sent to the API. `scripts/embed-stored-events.ts --from-file`, same two-path shape as `label-events.ts`.
- **Similarity is computed in Postgres, never in Node.** Selecting 1200 × 1536 floats to produce 1200 numbers
  is ~20MB of JSON per request; the function returns `(id, sim)` and the vectors stay put. `rankEvents` gained
  a `similarities` option beside the existing `vectors` one, so the offline persona script and production run
  identical maths.
- **NO ivfflat/hnsw index, deliberately** (said out loud in the migration so it doesn't read as an oversight).
  An ANN top-K answers "the 20 nearest", but similarity is 1 of 6 weighted signals — a pre-truncated list would
  silently override proximity. Full scan at ~700 rows is milliseconds.
- **The profile is a paragraph the person can read, edit and delete — never an embedded transcript.** The chat
  tuner (`/api/shopper/taste/chat`, tool-loop modelled on the vendor agent tuner) writes the SAME `about` text
  and chips shown on `/shopper`. A raw accumulating transcript drifts, over-weights whatever was said last, and
  cannot be corrected by the person it describes.
- **Works signed-out**, keyed on a browser-minted `device:<uuid>`. A Clerk id always wins and a caller-supplied
  id is ignored once signed in, so nobody can name a stranger's row. Most shoppers never sign in — an account
  gate would have shipped this to almost nobody.
- **A search stays one-off unless "Remember this" is tapped** — otherwise "tickets for my mum's birthday" shapes
  a feed forever. It **appends** (never clobbers) and is idempotent. When a saved profile IS used the feed says
  so, with a link to change or delete it.
- **A typed sentence beats the saved profile but does not erase it** — `blend(sentence, profile, 0.7)`,
  re-normalised, because cosine against an un-normalised query silently compresses every score toward zero.
- **`shopper_taste` is service-role only, no anon grants** — it holds what people said about their children and
  their money. Verified with a real anon client: read **and** write refused, while `vendor_events` stayed
  readable, which is the whole argument for the split.
- **Cost rule held:** once per new event at ingest (`embedNew()` beside `labelNew()` in the nightly sweep), once
  per *changed* profile (an `embedded_text` comparison makes an unchanged save free).
- **Verified:** `npx tsx scripts/taste-smoke.mts` — 25 checks against the real DB (identity spoofing refused,
  model-mismatch guard, emptying clears the vector, delete removes the row, every live event scored, an
  unembedded event scores 0 rather than vanishing). Plus HTTP probes showing the feed change from generic to
  family/free after one save, and a browser walk of the chips, the text box, the chat and "Remember this".
  `"learn to code"` now returns *Computer Basics* and *Introduction to Unix Command Line* — neither containing
  a word from the query.

### Added — the phone agent does things now, not just takes messages — 2026-08-11
- **Answering questions about products, prices and descriptions needed NOTHING built** — `buildBusinessContext`
  has always emitted a `## Products for sale` block (name, price, description) plus events, hours and owner
  FAQs straight into the prompt. No tool call, which is also *faster* than one on a live call. Verified in the
  live payload: all 4 tees with prices, all 3 Atlas events.
- **`request_booking`** (`/api/voice/booking`) — the first real action. Writes the SAME `booking_requests` rows
  as the web form, so a phoned-in booking lands in the existing `/vendor/bookings` inbox. Request-to-book takes
  no payment by design, which is exactly why it's the right first action: **the agent must never take a card.**
- **`check_availability`** (`/api/voice/availability`) — for Square Appointments vendors, real open slots, and
  the picked slot is **taken outright** (`confirmed`), not requested. **No Composio needed** — Square shipped
  last week with `searchAvailability`/`createBooking`; this mirrors the web flow so the two can't drift.
- **A spoken "Thursday" is not a date.** `/api/voice/context` now hands the agent **`today_date`** (city-local,
  never UTC — after 5pm Pacific a UTC date is already tomorrow and would book people a day out). A non-ISO or
  past date is **rejected, never guessed**: a wrong date sends someone to a shop on the wrong day.
- **A picked slot IS the date** — derived from the instant, city-local, NOT from the model's separate
  `requested_date`, or the row and the Square calendar disagree about which day someone turns up. Same rule as
  prices and fulfilment: the server derives, the caller never decides.
- **Every Square failure degrades to a plain request**, never an error — the slot may have gone mid-sentence,
  scopes may be wrong, Square may be down. A business with no Square gets `real_calendar: false`, which is the
  normal answer; the caller never learns which kind they rang.
- **"Request", not "booked"** unless Square actually reserved it. Email preferred but not required (spelling an
  address aloud is painful) — phone-only is accepted and the agent then says they'll be *called* back. Some
  channel is mandatory: a booking only one party knows about is worse than none.
- **Verified:** `scripts/voice-booking-smoke.mts`, **21 checks** against the real DB with cleanup — including a
  slot sent to a non-Square business degrading to a request without telling the caller they're booked, and a
  deliberately wrong `requested_date` losing to the slot's own day.
- ⚠️ **Square's live API is STILL unverified** (no account has ever connected), so `real_calendar: true` is
  exercised in shape only. Sandbox-testable: `npx tsx scripts/square-smoke.mts <sandbox-token>`.
- ⚠️ **SMS is unavailable** — carrier registration (10DLC / toll-free) not passed — so email is the only
  outbound channel and no phone action may be designed around texting a link yet.

### Fixed — a forwarded call now reaches the business the caller actually rang — 2026-08-11
- **One shared number can serve every business.** A business points their existing number at ours
  instead of voicemail, and the carrier stamps the originally-dialled number into a SIP Diversion
  header. Captured live from a real forwarded call:
  `<sip:+16287261846@…>;privacy=off;screen=no;reason=no-answer;counter=1`. So provisioning a vendor
  is a routing-table row, **not** a $1/mo number each.
- **The bug this fixes:** on a forwarded call `to` / `telnyx_agent_target` is always OUR number, so
  routing on it answered every forwarded call as whichever business owns the shared number.
  `resolveBusinessForCall()` (`lib/business-phone.ts`) now reads the diversion header first and falls
  back to the dialled number. `memberIdForNumber()` is unchanged, so nothing else moved.
- **An unrecognised forwarder resolves to NULL, deliberately** — falling back to the dialled number
  would confidently answer as the shared number's business to someone who rang a different one. A
  generic "I can take a message" is the only honest answer to a call we can't attribute.
- **The header exists only on `assistant.initialization` and is NOT persisted on the conversation
  record**, so `/api/voice/context` mints a `business_number` dynamic variable from it; the Telnyx
  `capture_lead` tool now passes it back and `/api/voice/lead` resolves from it first. `dialed_number`
  would have filed the message under the wrong business.
- **The trap that cost an hour: the forward timer races the carrier's voicemail.** `**61*…*11*20#`
  never fired — Boost voicemail answered at ~16s and won, while the phone's interrogation screen still
  said *Enabled*, because the rule **was** registered and simply never got a turn. `*11*5#` worked
  first try. Measured: a 5s setting actually forwards at **10–11s** — carriers round up, so the value
  you set is a floor, not a promise.
- **New: `docs/phone-forwarding-by-carrier.md`** — vendor-facing setup, leading with the voicemail race
  because it's the failure everyone will hit. Boost is documented as *tested*; every other carrier is
  marked standard-but-unverified, on purpose.
- **Verified:** 13 unit tests on header parsing and routing (incl. multi-hop, where the ORIGINAL number
  is the *last* entry), plus the real route handler run against the captured payload —
  forwarded-from-known routes correctly, forwarded-from-unknown refuses to impersonate, direct calls
  unchanged. Two live forwarded calls answered by the agent, one of them listened to end to end.
- **Not verified: only ONE carrier.** Boost, one handset. The Diversion header is standard, but carriers
  differ — some strip it, some use `History-Info` instead (which `extractDiversion` does **not** parse).
  Confirm on AT&T / Verizon / T-Mobile before betting a sales pitch on "works with any business".
- ⚠️ **The Telnyx tool change is LIVE but the code that reads it is not deployed.** The extra field is
  ignored rather than erroring, and direct calls are unaffected — but forwarded-call lead capture stays
  wrong until this ships.

### Added — Sentry for errors, PostHog keeps analytics + replay, and our own traffic is flaggable — 2026-08-10
- **Sentry owns errors end to end; `capture_exceptions` is now `false` in PostHog.** Running both filed one
  crash as two unrelated issues in two dashboards. The July note said PostHog's exception capture made
  Sentry unnecessary — **that was half wrong**: `capture_exceptions` is posthog-js, so it only ever saw the
  browser. Throws in API routes, the Stripe and Uber webhooks, server components and the nightly Trigger.dev
  sweep reported to nothing at all, which is exactly the silence the sweep failed in for weeks.
- Wiring: `instrumentation.ts` (`register()` + `onRequestError = Sentry.captureRequestError`),
  `sentry.server.config.ts`, **`sentry.edge.config.ts` separately** — `middleware.ts` runs on the edge
  runtime and cannot load the Node SDK — and `instrumentation-client.ts`, which runs before the app is
  interactive and so catches a crash during first paint that a React-mounted provider would miss.
- **The Trigger.dev worker is a separate deploy target** (`trigger/sentry.ts`, `@sentry/node`, registered
  with `tasks.onFailure`; `config.onFailure` is deprecated). Instrumenting Next.js does nothing for it. It
  fires only once retries are exhausted, and `flush(2000)`s because the runtime exits the moment a run
  settles. Its DSN must be set on Trigger.dev's **prod** environment — a `tr_dev_` key locally means
  everything you set from this machine lands in dev.
- **A Sentry issue links to the PostHog replay of the person who hit it** (`beforeSend` attaches the replay
  URL with a timestamp offset). It has to **import `posthog` as a module** — the app imports posthog-js so
  `window.posthog` is never set, and reading the global attached nothing at all. That was caught only
  because it was tested rather than assumed.
- **No Sentry Session Replay, deliberately.** PostHog already records, and its recorder is the one carrying
  the `data-private` masking; a second rrweb would double script weight inside the iOS WKWebView and
  capture the conversation text we just finished masking.
- **Verified against a local sink**, not by inspection: a real throw in a route handler and a real browser
  throw each produced an `event` envelope, and the PostHog context attached. **Re-verified against the real
  project** once the DSN was set — a server event flushed cleanly, and the browser posted through
  `tunnelRoute: "/monitoring"` (4 envelopes, all `200`, nothing direct to `ingest.us.sentry.io`). The tunnel
  engages **only for a real sentry.io DSN**; against a fake local one the client bypasses it, which is what
  made it look broken while wiring.
- **Everything no-ops without a DSN, including the build** (`withSentryConfig` skips source-map upload with
  no auth token). That is deliberate: this build is also an App Store release, and a missing analytics
  token must never be able to block a deploy. `NEXT_PUBLIC_SENTRY_DSN` is **baked at build time** — same
  trap as the demo-mode flag.
- **`/?internal=1` marks a device as ours** (`?internal=0` undoes it), setting `is_internal` on the PostHog
  person and on every event. Filtering our own sessions out by email only works while signed in, and most
  dogfooding is signed out — worse, one person is several "new people" to PostHog, because Safari, Chrome,
  an incognito window and the iOS app's WKWebView each have their own cookie jar and so their own
  `distinct_id`. At current volume that was most of the data. One "Internal" cohort now filters it.

### Fixed — the events feed had images all along and threw every one away — 2026-08-10
- **`lib/image-utils.ts` trusted three hosts**, none of them an event source, so `usableImages()` dropped
  every harvested poster, `ImageCarousel` returned `null`, and the card rendered as chips with no picture.
  The images were in the database and in the API payload the whole time. `next.config.ts` had the scraped
  hosts enumerated correctly — **the two lists disagreed**, which is the actual bug. Both now read
  **`lib/image-hosts.ts`**, so a host cannot be allowed for optimisation yet dropped at display again.
  `legacybusiness.org` stays deliberately tolerated-but-not-shown; that distrust was intentional.
- **`PersonalizedEvents` never rendered `image` at all** — the field was declared on `FeedEvent` (line 47)
  and used nowhere. Events now lead with a full-bleed poster, title and time on a frosted plate over it,
  when/distance badges on the image's top-right. Matches the business cards, so the app reads as one system.
- **Next 16 requires `images.qualities`.** A quality not on that allowlist is silently ignored and served at
  the default — so the profile hero's `quality={90}` had been coming out at **75** since the upgrade. Now
  `[75, 88, 90]`; posters ask for 88 and get it (verified `q=88` on all 51 prod requests).
- `ImageCarousel`'s default `sizes` for this aspect claims 320px, but the event card is 672px at
  `max-w-2xl` — on desktop that served a half-width file and upscaled it. The card states its real width.

### Added — every event has a real photo: 332/581 → 724/728 — 2026-08-10
- **SFPL had none at all** (249 events, the single biggest source, 43% of the feed). Its listing page turned
  out to carry a per-event picture as Drupal style variants, so the widest on offer was 620px. Stripping
  `styles/<name>/public/` gives the ORIGINAL — ~950×475, measured — and it costs **zero extra requests**,
  because the adapter already downloads that page. The `itok` query signs the derivative only, so dropping
  it is required rather than tidy: kept on the original path it 404s.
- **Funcheap stored 80×80 admin thumbnails.** WordPress names derivatives `<name>-WIDTHxHEIGHT.<ext>` beside
  the original, so `Emporium-80x80.png` (80×80) → `Emporium.png` (**747×490**). `fullSizeWordPressImage()`
  **verifies with a HEAD** rather than assuming — that suffix pattern also matches ordinary filenames, and a
  guessed URL that 404s is worse than a small image because next/image then renders nothing. Deduped, at
  ingest only, never on a read path.
- Coverage after re-scraping both sources: **724/728 (99%)**, up from 332/581 (57%), and **zero** thumbnails
  left in the table.

### Changed — business cards are the photo, and the home header is search-then-tabs — 2026-08-10
- **`MemberCard` is image-forward.** Portrait 4/5 photo with the name, distance and
  "neighbourhood · category" on a frosted gradient plate **over** the bottom of the image;
  the blurb and the tag row are gone. The card used to give more height to a block of text
  than to the picture, which reads as clunky in a feed of images. Carousel dots are off on
  this card (the plate owns that edge — `ImageCarousel` gained an `indicators` prop); the
  `1/3` counter and the type badge moved onto the photo. The name has its own full-width
  line: sharing a row with the distance chip clipped "Hamburger Haven" to "Hamburge Haven".
  Applies everywhere the card renders — home Shop rails, `/browse`, `/city`, `/category`,
  the event page.
- **The event page rails the same categories as the Shop tab.** `NearbyBusinesses` leads
  with the 8 closest, then Food & drink / Retail & shops / Artists & makers / … over
  everything within 5 mi of the venue, each still in distance order. The lead rail answers
  "what is right here"; the categories answer "what kind of thing am I after", which is the
  question someone has once they have decided to come.
- **Home header order is now search → tabs → city → section.** The 3-tab selector follows
  the search box instead of sitting under a supply pitch, so the first two things on screen
  are the two ways to move. Still sticky — position in the document doesn't change what it
  does once you scroll past it.
- **"For you" became a two-icon segmented toggle** (✨ For you / 📅 What's on), like a
  list/grid switch. As a single labelled pill it read as a filter you switch ON and left
  "what's on" unnamed; a pair says there are two views and you are in one.
- **"Free only" moved up into the topic pills** (first, before Music) — free is a fact
  about an event exactly like its topic, and it was the only reason that row had a second
  row under it. On Shop, the marketplace became a basket icon button on the
  "Browse all local businesses" heading row, instead of a full-width black bar between the
  city and the directory.
- **"Hosting something? / Own a local business?" moved to where the location caption was**,
  under the filters — it is the one line on the screen that asks the reader for something.

### Removed — the "Near me" radius filter, on both Events and Shop — 2026-08-10
- The pill, its radius slider, and the "Nearest first, measured from where you are" caption
  are all gone. **Nearest-first ranking stays** (it is the default, and every card prints
  its own distance, which is the caption demonstrating itself). What is gone is the ability
  to hide anything past N miles — a control whose only power was to make the evening
  emptier. The unplaced-businesses footnote went with it, since nothing is excluded now.
- What survives is the half that can still be acted on: "Turn on location to sort by
  distance", shown only when location is actually off.
- Reversible: this is UI only. `lib/proximity.ts` `RADIUS_STEPS` and the API's `maxMiles`
  parameter are untouched, so restoring the pill is re-adding the control, not the plumbing.

### Fixed — the event page said things that were not true, twice over — 2026-08-10
- **"What to expect" deleted.** Four cards restating the time, the place and the host — all
  of which are in the header three inches above — plus one line ("open to all") that is the
  chip at the top of the page.
- **A harvested event has a SOURCE, not a host.** "Hosted by Funcheap SF", with an avatar
  and a bio card, states something false: they listed it, they are not putting it on. For
  `isScrapedHost` events the host card is now a single line — "Listed by Funcheap SF ·
  Event details →" (the source's own listing) — and the sidebar's "Hosted by" link, which
  pointed at a dead `/members/source:funcheap`, is plain "Listed by" text.
- **The back row was reserving a band of empty screen** above the hero on a phone
  (`py-8` → `pt-3`, `mb-6` → `mb-3`).

### Added — native: NFC deep links live, swipe-back + white splash submitted — 2026-08-05
- **NFC fob → app is LIVE, and it turned out to be a web-only change.** The shipped App Store build already carried `applinks:whatslocal.ai` (verified with `codesign -d --entitlements` against the 2026-07-29 archive), the AASA was already served correctly, and `lib/native-links.ts` already routed same-origin paths into the webview. The only defect was the AASA **path list**: it claimed the auth callbacks and nothing else, so `/members/{id}` — what a fob encodes — went to Safari exactly as instructed. Claimed `/members/*`, `/events/*`, `/live/*`, `/featured/*`. **No rebuild, no App Review, works for existing users.** `/checkout` deliberately unclaimed so a Stripe return finishes in the browser it started in.
- Verified after deploy: prod serves the new list, **Apple's CDN** (`app-site-association.cdn-apple.com`) serves it too, and a real fob tap opened the app. A device that had already cached the old list needed one delete + reinstall.
- **Swipe to go back** (`ios/App/App/MainViewController.swift`) — `allowsBackForwardNavigationGestures = true` on Capacitor's bridge controller. Without it the app was a one-way trip: no chrome, no gesture, so any navigation that didn't return you on its own stranded the user.
- **The splash was blue because of the DARK variant.** `splash-dark.png` is navy with a white rounded tile, and `scaleAspectFill` on a square image over a tall screen scaled it to ~75% of screen width. Now: explicit white (**not** `systemBackgroundColor`, which is BLACK in dark mode) with the logo constrained to 160pt — same on every device, both appearances. The navy dark PNGs were overwritten so nothing can render blue. `@capacitor/splash-screen` re-instantiates the same `LaunchScreen` storyboard, so one edit covers launch and post-launch.
- Submitted as **1.0.1 (5)**. Both changes are compiled into the binary, so they reach users only on update. Confirmed by eye in the Simulator on the Release build before archiving. Backups in `whatslocal-ios/.backup-splash-20260805/` (that repo has no git).

### Changed — a city is live when a source feeds it, and Sourcing shows the real pipeline — 2026-08-05
- **`lib/cities.ts` — live-ness is DERIVED, never declared.** A city is live when at least one enabled source in `lib/sources/registry.ts` points at it. This is what was asked for from the start (2026-07-31: *"when i want to turn on a new place i add all these sources and all these sources are being added to the place"*; 2026-08-01: *"the nearest city that we have populated and activatd in the admin > source"*) — what shipped instead was a hand-typed `status: "live"` flag in `lib/prototype-data.ts`, so the header could have claimed a city with no events in it.
- `SourceDef` gains **`city`** (a `CITIES` id) and **`enabled`**. All 10 current sources are `city: 'sf'`. Verified by temporarily adding one Oakland source: the live list became `San Francisco, Oakland` and a viewer in Oakland flipped from "we're not in Oakland yet" to "Oakland" with no other edit. Reverted after the test.
- `CityHeader` now asks `isCityLive()` / `nearestCity()` instead of reading `PLACES.status`.
- **Admin → Sourcing renders the pipeline that actually runs.** It was importing `SourcingAdmin` from `app/prototype/admin/page`, which listed six invented sources with invented stats (`@eltechosf`, "pulled 23 · published 18", "12 min ago"). So the screen had shipped but the wiring never had — the sources you could see were not the sources that ran. New `components/admin/SourcingPanel.tsx` + `app/api/admin/sources` (isAdmin-gated) show the 10 real recipes with counts measured off the events they wrote, plus each source's drift baseline so a shortfall is visible.
- **It surfaced a source holding zero events** (`somarts`) — which on inspection is correct, not broken: SOMArts lists a single event right now and listed none when the table was seeded. Worth recording because the first instinct was "dead source", and the panel cannot tell "nothing to write" from "drifted" on its own. The check is one command: `npx tsx scripts/publish-events.ts --only <id> --dry-run`.
- Still deliberately manual: **adding a source means editing `registry.ts` and deploying**, because a source is a scraping recipe (selectors, venue templates, drift baselines), not a row you type into a form. The screen says so where someone would look for a switch.

### Changed — the Collabs section is hidden on the vendor dashboard — 2026-08-05
- The whole **Collabs** block on `/vendor` (the Upcoming card and the "Team up → Link your business" variant) no longer renders. The dashboard now opens on Pro tools. `VendorHome.tsx` → `SHOW_COLLABS`, flip to `true` to restore; every render branch is left intact, matching the other four temporary hides.
- Declared `const SHOW_COLLABS: boolean = false`, **not** the literal `false`: a literal makes TypeScript treat the branch as unreachable and stop narrowing `memberId` inside it, which is exactly what broke the build the last time something in this file was switched off with a bare `false &&`.

### Ops — prod outage, droplet resize, swap, snapshot — 2026-08-05
- **The site 502'd for ~35 minutes.** A deploy interrupted mid-upload had already reached CapRover, which began building **v95** on the 1GB droplet; the box wedged (CPU 100%) and Cloudflare returned 502. `deployedVersion` never advanced past 94, so the running app was never replaced — CapRover later went 94 → **96**, skipping the abandoned build.
- **Droplet resized to 2GB / 2 vCPU** (`s-2vcpu-2gb-amd`, CPU+RAM only, so it stays reversible).
- **The likely root cause was no swap.** The box had `Swap: 0B`, so a build spiking past physical memory had nowhere to go and got OOM-killed rather than slowed. Added a **2GB swapfile** with `vm.swappiness=10`, persisted in `/etc/fstab` + `/etc/sysctl.conf`. *Circumstantial: the reboot wiped the build logs, so this is inferred from timing, not proven.*
- **Disk was never the problem** — 39% used, 36GB free. Pruned images older than 30 days (167 → 103, 2.1GB) which keeps recent rollback images; `docker builder prune` reclaimed 0B. **Do NOT run `docker system prune -af`** — it deletes the images CapRover's one-click rollback depends on.
- **Snapshot taken:** `marketplace-v96-20260805-0432` (23.4GB), live, no downtime. Note it captures the droplet only — all real data is in Supabase and is not covered by it.

### Fixed — event cards said the same thing twice, and got the day wrong — 2026-08-05
- **The day heading now sticks** while its own events scroll past (`PersonalizedEvents`), parked under the app header + tab row. Scrolling a long day meant losing track of which day you were in and scrolling back up to find out. `sticky` inside each `<section>`, not the page, so each heading hands over to the next instead of stacking.
- **One distance badge per card, not two.** `lib/reco/rank.ts` pushed "0.3 mi away" into the reason pills while the card already carried the green badge beside the time — the same number twice, in two styles, burning one of three reason slots.
- **"today" / "tomorrow" dropped from the reason pills too.** Between the pinned day heading and the badge beside the title, a third copy is not emphasis. `in 3 days` stays: turning "Thu, Aug 6" into a distance from now is real work a reader shouldn't do.
- **The day labels were WRONG, city-local vs UTC — again.** `Math.round((Date.parse(date + 'T12:00:00Z') - Date.now()) / 864e5)` measured UTC noon against the wall clock, so after 5pm Pacific (once UTC rolls over) tomorrow's events were labelled **"today"** and the day after "tomorrow" — visibly wrong, since those cards sat under a "Tomorrow" heading. Now compared as calendar dates against `sfToday()`, which is what `lib/sf-date.ts` exists for.

### Changed — the city header is just the city name, big — 2026-08-05
- "Near you in San Francisco" in 13px grey → **San Francisco** as an `h1` at 24px. The old line spent most of its width explaining a mechanic the surfaces below already state ("Nearest first, measured from where you are"); the name alone answers where you are.
- The not-covered-yet state (amber "We're not in {city} yet" + the **Bring WhatsLocal to {city}** button) is unchanged, and so is the rule that it says **nothing** until the position settles — a city name shown to someone who denied location would be a guess.

### Added — "Nearby businesses" on the event page — 2026-08-05
- **A rail of the closest local businesses at the bottom of every event page** (`components/events/NearbyBusinesses.tsx`) — the Amazon-style "while you're there" recommendation, ranked by distance **from the venue**.
- **Measured from the EVENT, not from the reader.** Someone looking at a market three miles away wants to know what else is on that block when they arrive — a fact about the venue, the same for everyone. So it renders on the **server**: no position lookup, no permission dialog, nothing to wait for. The heading says "distances are from the event" out loud, because the identical green chip on the home directory means "from you".
- Nearest 12 within 5 miles; anything further isn't the same trip. Excludes the host (already named at the top), and shoppers/influencers (people, not places you can walk into). Businesses with no coordinates are **dropped, not floated in at the end** — this section is a claim about proximity, and a record we couldn't place has no business making it. Self-hides when the event has no pin or nothing is close.
- Uses `fetchAllMembers()` (24h `unstable_cache`), so it costs a page render nothing.

### Fixed — infinite render loop on every event and member page with no memories — 2026-08-05
- **`data?.posts ?? []` in `lib/data-hooks.ts` returned a NEW array on every render.** `MemoriesGrid` copies `posts` into state in an effect keyed on it, so the effect re-fired forever: an event or member page with nothing tagged to it yet pinned a core with "Maximum update depth exceeded" until the tab was closed. Measured 66 errors in ~8s on one event page; 0 after.
- Every `?? []` in the file now returns one shared `NONE` constant — the same fix `EMPTY`/`EMPTY_COLLABS` already had further down for the same reason. Downstream `useMemo`s across the feed, directory and live surfaces were also recomputing on every render off these arrays.
- Found while verifying the nearby-businesses rail. Pre-existing and unrelated to it (the loop reproduces on `HEAD`, and on events with no pin where the new section never renders).

### Added — proximity ranking for businesses and posts — 2026-08-05
- **Businesses rank nearest-first on the Shop tab** (`components/home/LocalDirectory.tsx`). A ranking change only, **no migration**: 93% of members already carried `latitude`/`longitude` (the map drew pins from them) and nothing read them — `/api/directory` sorted by name-match score, else the connector's order.
- **`lib/proximity.ts`** — the shared measurement (`milesTo` / `byDistance` / `milesLabel`). `0,0` is treated as unplaced, not as a point in the Atlantic: it is what an empty numeric column looks like, and measuring it would put every unfilled record ~5,000 miles away rather than nowhere.
- **A record we couldn't place never shows a distance and never ranks as if nearby.** `MemberCard` shows a green distance chip, or a grey "no location" chip when the reader's position is known but the business's isn't — a silent gap where a distance should be reads as "close". With "Near me" on, unplaced members are **excluded** and the count is stated, because a filter that exempts what it couldn't place is not a filter.
- **"Near me" adds one thing only: hide past this radius.** Nearest-first is the default, requested after first paint, so the grid never waits on a permission dialog.
- **No facet pills here.** `FilterSidebar` in the search bar directly above already owns size/ownership and carries them to `/explore`; a second set on the same screen could disagree with it. Distance is the one axis this surface owns.
- **Posts capture real coordinates going forward** — migration `20260805120000_post_coordinates` (nullable `lat`/`lng`, applied to prod and registered). `ShareComposer` already resolved a device fix to build the location label and then discarded it; it now keeps it, rounded to ~110m. `POST /api/posts` stores both or neither.
- **Tagging a post to your business sends the BUSINESS's pin**, not the phone's (`/api/me/business-location` now returns lat/lng) — posting about the shop while standing elsewhere must not place the post where you're standing.
- **Forward-only, and old posts degrade honestly.** `posts.location` holds neighbourhood *labels*, and signed-out users get the literal string `"Current location"`. Geocoding those was considered and **rejected**: it returns a district centroid and would print "0.3 mi away" about a point we invented. Existing posts keep recency order, sort behind placed ones, and show no distance.
- **One geolocation prompt across the whole home screen.** `LiveFeed` and `LiveNowRail` were calling `getUserPosition()` directly — a second dialog on the Feed tab — and now read the shared `useHomePosition`. `useViewerPosition` (community chats) keeps its own retry and `?at=` spoof semantics but borrows an existing home fix instead of asking again.
- Verified in a browser at 375px, not just typechecked: distances checked against real addresses; "Near me" at 2 mi cut one rail 26→19; with coords stripped from a third of the directory, 30 cards showed "no location", all sorted last, and none leaked through the radius; a temporary prod post at Hayes Valley rendered "0.3 mi" and led the feed while the 10 coordinate-less posts showed labels only (row deleted afterwards).

### Added — video upload is LIVE, on the WhatsLocal AI brand channel, with delete — 2026-08-04
- **YouTube video storage works end to end.** ProLocalIQ's old credentials were confirmed dead (`deleted_client` — the OAuth client had been deleted, which invalidates every token it ever issued), so a new client + refresh token replaced them. Verified: uploaded → landed **unlisted** on the `WhatsLocal AI` brand channel → embedded back through `lib/embed.ts`.
- A refresh token binds to whichever channel is picked **at consent**, not to the Cloud project that owns the OAuth client — the client can live in any project. The first token bound to a personal channel; re-consenting and choosing the Brand Account moved it.
- **`uploadVideo` now returns `channelId` / `channelTitle`.** The API already sent them (the request asks for `part=snippet`) and they were being discarded, which left the one thing worth confirming — that videos land on the brand channel and not someone's personal one — impossible to check without a wider scope and a second call.
- **Unlisted, not private — private cannot be embedded at all.** Verified by uploading the same clip both ways: the private one renders "This video is private" for every viewer, because the check runs on the *viewer*, not the embedder. Unlisted is the correct model: excluded from search/browse/recommendations, playable by link.
- **Deletion** (`deleteVideo` / `deleteVideosSafe` + `DELETE /api/posts/[id]`). A YouTube URL is its own access control, so an unlisted video outlives its post row and stays playable forever to anyone holding the link — deleting the row alone made "delete" a lie. Needs the `youtube.force-ssl` scope (`youtube.upload` can only ever add), so `scripts/youtube-refresh-token.mjs` now requests both.
- **Author delete is separate from moderation remove, on purpose.** `lib/moderation.ts removePost()` is a soft hide paired with `restorePost()`; reaping its video would make restore impossible. `deleteOwnPost()` is the author meaning it, and only that path reaps. Ownership is enforced in the DELETE statement (`author_id = …`) rather than a read-then-check, so there is no window between the check and the delete.
- **Moderator purge** (`purgePost` + `action: 'purge'` on `/api/admin/moderation`). `remove` stays a soft hide with `restore` as its counterpart — a moderator acting on a complaint should be able to be wrong — but a hidden post's video stayed playable to anyone holding the link, so "taken down" wasn't true. Purge is the deliberate, irreversible one: it destroys the row and reaps the media, and reports `videosDeleted` vs `videosFound` separately, because the row can be gone while YouTube refused. Verified end to end against prod: upload → post → `remove` (video still up, correctly) → `purge` → video **404** on YouTube. Note YouTube's oembed lags a delete by a few seconds — it read 200 immediately after, 404 ten seconds later.
- **`YOUTUBE_*` set on CapRover prod** (46 → 49 env vars, all originals preserved, `NEXT_PUBLIC_DEMO_MODE` still `0`). *Unverified: an authenticated upload on prod — the route checks auth before `youtubeConfigured()`, so the 503→working transition can't be observed from outside.*
- **`extractVideoId` checks the HOST first.** A YouTube id is any 11 characters of `[A-Za-z0-9_-]`, and ordinary path segments qualify — `https://example.com/not-a-video` was yielding `not-a-video` as an id, i.e. a delete call built from a non-YouTube URL. Also means legacy Supabase video URLs are correctly ignored.

### Fixed — the nightly event sweep never actually worked in production — 2026-08-04
- **Trigger.dev prod had ZERO environment variables.** They had been set on the **dev** environment, so the `0 9 * * *` sweep would have failed on every run, silently, forever. Set `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `GOOGLE_PLACES_API_KEY` / `OPENAI_API_KEY` on prod.
- **The deployed worker ran Node 21, which has no native WebSocket** — `@supabase/supabase-js` builds a Realtime client inside `createClient()`, which throws without one, so every Supabase call died on boot. Local runs (Node 25) passed with identical code, making it invisible outside the deployed environment. `trigger.config.ts` now pins `runtime: 'node-22'` (deployed as **v20260804.4**).
- **Verified end to end in prod**, not just deployed: a full-path run on the smallest source returned `pulled 3 · kept 3 · written 3 · published 3 · failed 0 · labelled 5 · pending 0` — which also cleared the 5 long-unlabelled events.

### Added — draft review queue for scraped events — 2026-08-04
- **Admin → Scraped drafts** (`components/admin/EventDrafts.tsx`, a tab beside Sourcing): the 41 held-back `downtownsf` events were invisible with no way to act on them. Publish or reject each one.
- Migration `20260804150000_event_review_state` adds `vendor_events.reviewed_at`. It is the missing half of the state: `active = false` alone could not distinguish "nobody has looked at this" from "a reviewer said no", so a rejection could not be recorded — and deleting the row was worse than useless, since the next sweep re-inserts it as a fresh draft. Both decisions stamp the column, so **a rejection survives re-scrapes** (verified against prod, including a simulated re-scrape).
- The queue is scoped **by source**, never by `active` alone — the `--hide` kill switch flips `active` off across every scraped row, and an `active = false` queue would then present all ~800 published events as awaiting review.
- Finished events are excluded using the same rule as `pruneFinished` (end date where there is one, city-local), so a months-long exhibition that opened in June stays a live decision while a one-night event in March does not.
- The card shows the **date range** (`2026-03-21 → 2026-09-05`, "runs to"), because a still-running exhibition displayed as its opening day looks exactly like the mis-parse this queue exists to catch.

### Added — city header on home; hides + padding fix — 2026-08-04 (later)
- **A city header sits under the home tab row, on all three tabs.** Two states: "Near you in {city}" when we cover it, or an amber "We're not in {city} yet — the nearest city we cover is {X}" with a **Bring WhatsLocal to {city}** button. The button records a PostHog `city_interest` event, so it is not a placebo — demand per city is the signal that decides where we open next.
- **It says nothing until location is known.** Falling back to the one live city looks harmless and is not: "Near you in San Francisco" shown to someone in Chicago who denied location is a confidently wrong statement, and the feed below already offers to turn location on.
- **`lib/home-position.ts` — one position lookup for the whole home screen.** Extracted from `PersonalizedEvents` the moment a second surface wanted coordinates: two components each calling `getCurrentPosition()` is two permission dialogs on a cold load, shown one after another on iOS. Module cache (survives tab switches) + localStorage (survives reload) + a shared in-flight promise (survives two components mounting in the same tick).
- **Hidden for now, each a one-entry revert:** "Opportunities near you" (the Collabs *Join* tab) and the paste-an-event-link box on the vendor dashboard. The Collabs switcher now hides itself when only one tab remains — by not rendering, not a `hidden` class, which loses to `inline-flex` on the same element because competing display utilities are resolved by stylesheet order.
- **Vendor Messages was double-padded on mobile.** The page added `px-6` on top of the layout's always-applied horizontal padding, leaving 40px of gutter each side of a 375px phone. Content went 295px → **343px** wide, vertical 40px → 24px.

### Changed — one pill size across the app, one-word Events toggle — 2026-08-04 (later)
- **Every pill is now the same size** — `px-4 py-1.5 text-sm font-medium`, measured identical to the Feed tab's (14px text, 6/16px padding, 34px tall). The topic chips (Music, Art, …) and Free only / Near me were a size smaller than the rest of the app.
- **The For you / What's on radio became ONE pill.** Two labelled pills plus a heading overflowed a 375px phone once they matched everyone else's size, and the choice was never symmetric anyway: For you is the default, What's on is what you get without it. It now reads as a filter you switch on — the same affordance as the Free only / Near me pills below it.
- **"Events near you"** is `text-xl`, taking over from the **"Upcoming events"** heading that sat right beneath it saying the same thing (`CommunityEventsLive` gained a `hideHeading` prop rather than losing its heading, so it stays reusable).
- Supply CTA shortened to **"Hosting something? Add an event"**.

### Changed — one Events tab, one search box, remembered location — 2026-08-04 (later)
- **Events is one tab again** (`Events · Feed · Shop`), with For you / What's on as a toggle inside it. Splitting them had spent two of four tab slots on a single idea and pushed Feed and Shop to the edge of a phone. `?tab=events`, `?tab=foryou` and `?tab=whatson` all resolve; `whatson` lands on the What's on view.
- **The top search slot swaps with the tab.** On Events it *is* the event search (`components/feed/EventSearchBar.tsx`, lifted out of `PersonalizedEvents`, same wrapper as `HomeSearch` so the width is identical); elsewhere the business search returns. Two search boxes stacked would be two inputs competing for the same intent. Submitting from What's on switches to For you — a ranked answer to a sentence is what For you *is*, and staying on a chronological list would read as the search having done nothing.
- **The supply CTA follows the tab**: "Hosting something? Add, organize or host an event!" on Events, "Own a local business? Add your profile!" elsewhere. Both now link to `/join` (the business one pointed at `/businesses`).
- **"Events near you"** heading with the view toggle right-aligned on the same row — the toggle modifies that heading, so it belongs beside it rather than in the row that switches whole sections of the app.
- **Location is remembered across sessions** (`localStorage`, 24h TTL, rounded to ~110m). It was module-scope only, so it survived tab switches but died on every reload — meaning a fresh `getCurrentPosition()` per load. Where the permission is a standing grant that resolves silently; where it is not (a **dismissed** browser prompt, or iOS **"Allow Once"**, which lapses on backgrounding) it was a permission dialog on every single launch. The feed now opens already sorted by distance without asking the device.

### Changed — home tabs, feed paging, self-ageing countdowns — 2026-08-04
- **Home tabs are now For you · What's on · Feed · Shop.** For you leads and is the default (`/` is For you); the What's on/For you sub-toggle inside Events is gone. `?tab=events` still resolves, for links and sessions already in the wild.
- **The For-you feed no longer stops at 60.** The API returns up to 240 ranked events and the client reveals a screen at a time; past that it says so (`Showing the top 240 of 753`) rather than ending silently. Paging is client-side on purpose — a page parameter would re-run `extractPersona` per page, turning a free scroll into a model call each time.
- **Countdown badges age themselves.** A tab left open used to sit on "in 9m" indefinitely. Elapsed time is measured entirely in the browser (never server-clock minus client-clock, which would read a skewed phone's offset as real elapsed time); the absolute countdown still comes from the server, which is why it is computed there.
- Footer subtitle → "The Digital Homepage for your Local world."
- `data/` (~24MB of regenerable scrape caches) is now gitignored.

### Changed — Google/Apple-only accounts, native iOS login, App Store readiness — 2026-07-22
- **Accounts are Google/Apple only.** Removed phone from account sign-in/sign-up (vendor login modal + `/join` "who" step, incl. the `code1` account-phone step). Phone remains ONLY for business ownership verification (`code2` OTP). No email/password.
- **Native in-app OAuth (verified on device):** Apple via `oauth_apple` redirect kept inside the WKWebView (`appleid.apple.com` in `capacitor.config.ts allowNavigation`); Google via two local SPM Swift plugins (`capacitor-apple-signin`, `capacitor-google-auth`) → id token → Clerk `authenticateWithGoogleOneTap`. `lib/native.ts` + `lib/native-auth.ts` + `/sso-callback` + `components/auth/OAuthBrandIcons.tsx`.
- **iOS subscription paywall hidden** (`useIsNativeApp` gate) for Apple 3.1.1 compliance; web/Android unchanged.
- Provisioned the App Review demo account (linked to the Xeno Pro profile); app remains fully usable without login.

### Added — sell path made real, fulfillment, collab Event/Attendees tabs — 2026-07-17
- **Stripe Connect has a UI entry point** — new `StripeConnectCard` ("Set up payouts") calling the previously-orphaned `create-account`, plus a **"Start selling" checklist** (`components/vendor/SellChecklist.tsx`) on the dashboard: connect shop → set up payouts → (delivery only when `uberConfigured()`). Replaced a dead Stripe banner that could never render.
- **Order fulfillment: pickup vs delivery** (migration `20260717120000` — `orders.fulfillment_type`, a `collected` status, `delivery_fee_charged_cents`; **applied to prod**). Fulfillment is chosen **before payment** (`components/checkout/FulfillmentPicker.tsx` + `GET /api/checkout/fulfillment/[memberId]`), so the courier fee actually goes into the PaymentIntent (`amount = items + fee`, `application_fee = 5%(items) + fee` → the fee lands with the **platform**, who pays Uber; 5% is on items only). Buyer sees the pickup address on checkout + success; pickup orders close via "Customer collected it".
- **Uber Direct OAuth** (`lib/uber-direct.ts`) — client-credentials token mint + 30-day cache (the old `UBER_DIRECT_SERVER_TOKEN` was a credential Uber doesn't issue). `/api/uber/dispatch` **re-quotes** (quotes expire in 15 min) and absorbs+logs the fee delta. Only the three `UBER_DIRECT_*` credentials remain before delivery works.
- **One "Integrations" hub** (`/vendor/integrations`) — Bank account (Stripe) + Store Catalog (Shopify/Square) + Delivery on one page; a single dashboard tile (after "Your agent"). `/vendor/payments` redirects here.
- **Collab room Event + Attendees tabs** (`components/vendor/CollabEventTab.tsx`, `EventAttendees`) — appear once the event exists. Real `Thread` (NetworkManager) is now tabbed (Chat · Participants · Event · Attendees); demo mirrors it. New public `GET /api/vendor/events/[eventId]`.
- **`/vendor/assistant`: "View profile" + "Test agent" buttons** — Test agent opens the same `AskAssistant` chat the profile's Inquire button uses.

### Changed — pricing honesty, locked-lineup roster, Composio/claim wiring — 2026-07-17
- **Pricing only sells what exists.** Removed "AI voice agent **with booking**", "Analytics & insights" (no such feature), and the **$10 "AI customer-service agent"** (the agent is `PRO_CAN` only — Member payers were refused it). $10 now reads "send invites & host events" (its real grants). Promo-art Calendar/CRM/Deliver claims dropped from copy. Rule recorded in `BillingPlans.tsx`.
- **Participants tab splits once the lineup locks** — "On the lineup" (locked in) vs "Asking to join" (requested after lock); the host gets inline **Add / Not now** wired to the lineup approve/decline endpoint (exposed `lineupInviteId` via `getRoomRoster`).
- **Claim writes `vendor_profiles`** so it lands on the dashboard, not a second search+verify at `/vendor/setup` (three screens removed).
- **Composio "Connected" only after OAuth confirms** — `finalizeConnection()` checks for an ACTIVE connection at the `?connected=` callback instead of writing at initiate (which left a false "Connected" + a nightly-sync entry on abandoned consent).

### Security — 2026-07-17
- **Stripe Connect + Uber routes gated.** `create-account`/`create-account-link`/`account-status` took `memberId`/`email` from the body with no auth (anyone could open a Connect account against any business); now `resolveActor`-gated, email from Clerk. `/api/uber/quote` + `save-delivery` had no auth and looked orders up by a body `orderId` — quote is rekeyed on `memberId` (no order to hijack) + rate-limited; `save-delivery` deleted; dispatch uses `resolveActor`. All enforce the vendor's `uber_direct_enabled` on the paid path.

### Added — collab composer, organizer ICP rebuild, unread badges — 2026-07-16
- **`components/match/PeoplePicker.tsx`** — the ONE people picker: search the semantic matcher, **Clear** to fall back to just who you've picked, pick/drop animate in place (`pick-confirm`/`check-pop` + mirrored `unpick-confirm`/`check-unpop` in `globals.css`, both `prefers-reduced-motion`-aware). Shared by the collab composer, the organizer lineup, and the new-event composer. No nested scrollbox.
- **`components/vendor/CollabComposer.tsx`** — the ONE collaboration composer (name + description + PeoplePicker + create), shared by the dashboard Create card, the new **`/vendor/collab/new`** page, and the Add-people modal. Returns `occasionId` so callers deep-link straight into the new chat (`?collab=<id>`).
- **`/vendor/event/new`** — the event twin of `/vendor/collab/new`: progressive form (name first; description/when/where/capacity appear once named), PeoplePicker for the opening lineup, then lands you inside the event (`/vendor/organize?event=<id>`).
- **Unread badges** — Messages tabs (Collaborations/Customers), per collaboration card, per customer thread. `app/api/vendor/activity` returns every message as `{key, at, mine}` (`getRoomActivity` + `getCustomerMessageActivity`); `lib/unread.ts` owns "last seen" in localStorage — **no read-state table**. SWR-cached via `useVendorActivity` so badges paint from cache. Demo read-state is memory-only (reload restores badges).
- **Participants tab** in the collab room — In / Joined / Invited, your row is the "I'm in 👍" toggle. Encodes that accepting only opens the chat; "I'm in" is the commitment.
- **Dashboard Collabs is idea-first** — "Ideas for you" built from complementary matches (deterministic, no AI cost) → tap → prefilled composer. **Join/Create** toggle (Join default) beside the title.
- **`lib/lineup-roles.ts` `inferRole()`** — infers a lineup role from what a business already is (taquería → food, muralist → performer, community org → partner).
- **`lib/demo-collab-store.ts`** — collabs created in the admin demo persist locally so "create → open the chat" lands somewhere real.

### Changed — organizer (core ICP) rebuilt around the collab patterns — 2026-07-16
- **Organize is list → detail**: events are a card list with a "Create new event" card on top; opening one makes the event the title with its tabs beneath. Removed auto-select + the sidebar/horizontal-pill strip.
- **Lineup tab leads with participants**, grouped by state (In / Asked to join / Invited / Declined) like the collab Participants tab; role chips double as a **filter** (`PARTICIPANTS · 2 of 7`); **+ Add** opens its own view. The tab was ~2,818px of everything-at-once with the search buried under the whole roster.
- **Attendees**: capacity stat + progress bar + "N spots left"; rows rebuilt (a long email used to squeeze the name out). **Messages**: real chat bubbles; SMS/email blasts render as a centred system line.
- **Free tier is a real network participant** — entitlements already granted `networkReceive`, but `CollabsGate` forced Free into an inert "you're not in the network yet" preview. Free now receives/accepts invites and chats for real; only *initiating* is gated.
- **Messages**: title + tab bar hide while a chat is open; **Pending** = invites received + things you asked to join (invites you *sent* live inside the collaboration you created).
- **Share composer**: dropped the required-tag gate + amber alert card — the feed is back on home and `getPosts()` is unfiltered, so untagged posts land somewhere.
- **Shop**: removed the shipping banner + hero; added quick-filter pills (orthogonal to the sidebar) + Apply filters; smaller marketplace button.
- **Footer**: Explore = Add your business / Business login / Admin demo / Run an event; "Your business" section removed; directory hubs (`/city`, `/category`, `/explore`, `/browse`) moved to a quiet, **visible** "Browse" row to keep them crawlable.
- Messages moved out of the shopper bottom nav into `/shopper`; `VendorNav` Home+Messages sit together on the left; `VendorBackBar` suppressed on pages that own a specific back affordance.

### Removed — 2026-07-16
- **"New business requests"** panel — participating means having an account, so a business not in the directory signs up rather than being hand-added by an organizer (table + API kept).
- **"Invite as"** role picker — roles are inferred; picked people show their inferred role emoji so the inference is visible before sending.

### Added — Vendor Messages, conversational agent tuner, collab tiering — 2026-07-10
- **Vendor Messages inbox** (`/vendor/messages`, new nav tab): (1) **customer DMs** — real conversations customers had with the business agent (`app/api/vendor/messages` + `.../[conversationId]` over `chat_conversations`/`chat_messages`, `resolveActor`-gated), transcript inline; (2) pinned **"Your AI agent"** chat (`app/vendor/messages/assistant` + `components/vendor/VendorAgentChat.tsx` streaming `/api/chat/[memberId]`).
- **Conversational agent tuner** on `/vendor/assistant` — a **"Tune your agent"** panel (`components/vendor/AgentTuner.tsx`) that refines the customer-service agent by **chat or voice** ("make it less aggressive" → applies + confirms). `app/api/vendor/assistant/tune` = OpenAI tool-loop (`update_tone`/`add_note`/`remove_note`/`set_enabled`) editing `assistant_persona`+`business_knowledge` (the owner inputs `buildSystemPrompt` composes — never the fixed scaffold/tools/live facts). `app/api/vendor/assistant/voice` = OpenAI Realtime session grounded in the current config; the transcript is applied on hang-up (reuses `VoiceCall`). Demo actors preview without persisting.
- **Free can create self-hosted events** — Events unlocked on the vendor dashboard for every tier (`VendorHome`): CRUD + RSVP, no lineup/collaboration (that stays Pro).

### Changed — collab tiering, member-profile polish — 2026-07-10
- **Collabs tiered** (`NetworkManager`/`CollabsGate`): **Pro** = own + invite/add + New collaboration + Create-event in chat; **Basic** = read/chat only, all collaborations shown as **Joined** (no Owner badge), no invite/add, no Create-event; **Free** = inert **demo** (one demo collaboration + static demo chat + demo invites) with "you're not in the network yet — upgrade to Basic" notice cards. Removed the two redundant Free banners (`DemoBanner`, the `!canOwn` note in Free).
- **Inquire** button on member profiles now gated on the `textAssistant` entitlement (`ActionBar canInquire`) — no more dead button on free/unclaimed listings.
- **About** section header (vendor dashboard): left-aligned, blue **Edit** pill + gray **View profile** pill.
- **Resources** tab: removed the "Link your business" gate and the `CollectivePromoModal` "See how it works" popup/button.
- **`/browse`**: back-to-home button + Feed/Events/Shop quick-nav pills.
- **Seed member `89516919-…` reworked into "Xeno"** — personal founder profile (SF) with 4 XENO merch tees + 4 hero artworks (Supabase Storage; host added to `next.config`) + 3 host-your-own **Atlas** events (immersive cultural journeys). Old Zahab hero images/endorsements/demo-feed refs repointed.

### Added — /join in-app onboarding interview (voice + text) — 2026-07-08
Deployed to prod (connector → Netlify; marketplace → CapRover `marketplace` v17). Commits `e5bb715` (marketplace) + connector `8a08aea`.
- **New interview step in `/join`** (`app/join/JoinFlow.tsx`) between verification and the plan picker. After the member is created + verified/claimed, the person picks **Talk it out** (in-browser OpenAI Realtime **voice**, WebRTC — same plumbing as the business voice agent, no phone number), **Type it** (the `/onboard` chat brain), or **Skip**. `components/join/JoinInterview.tsx` drives the choose/text/voice surface.
- **Both modes enrich the just-verified member via the connector's FULL profiling brain.** Transcript → `POST /api/join/enrich {memberId, messages}` → `onboardFromMessages(messages, { memberId })` → connector `marketplace-onboard`, which gained an optional **`memberId` = enrich-in-place** path: same `buildSystemPrompt` profiling (~45-field schema), price normalization, `enqueuePostSave` enrichment, and Pinecone re-embed — run against the existing member instead of minting a new id. **Protects the verified anchors** (name, memberType, claim status, phone/businessPhone/trustedPhone, googleMapsUrl, lat/lng, city) from being overwritten. Backward-compatible: no `memberId` = unchanged create path (booth QR onboarding untouched).
- **Voice plumbing:** `app/api/onboard/voice/route.ts` mints the interviewer Realtime session with `interviewVoicePrompt()` (`lib/onboard.ts`); **not** Pro-gated (person is mid-join), bounded by Clerk sign-in + `VoiceCall`'s 5-min cap. `components/VoiceCall.tsx` is now parameterized (`tokenUrl`/`tokenBody`/`onTranscript`) and harvests the transcript from the `oai-events` data channel; existing business calls unaffected.
- **Replaces the deprecated Telnyx call-in onboarding** (connector `voice-tool.js` / Telnyx Voice AI Assistant). That path is dead/unused — this in-app interview is the onboarding now, and is actually richer (profiles the whole conversation vs. relying on the agent to fill a tool) and lower-latency (direct WebRTC, speech-to-speech, no PSTN hop).

### Launched — SF launch: tiers, payments, verification, security, enrichment — 2026-07-08
Went LIVE on prod (`whatslocal.ai` / CapRover). Full write-up: `session-context/2026-07-08-sf-launch.md`.
- **Demo mode OFF** in prod (`NEXT_PUBLIC_DEMO_MODE=0`) — `/vendor/*` now requires real Clerk auth. Added johnxen to `ADMIN_CLERK_USER_IDS`.
- **Tier model finalized** (`lib/entitlements.ts`, `BillingPlans.tsx`): **Free** = posts + discovery (community/resources); **Member $10** = + text agent + *receive* invites + claimed profile; **Pro $30** = + *send* invites + organize + booking voice agent + commerce. Launch discounts via **Stripe coupons**, not an app flag (removed the `NEXT_PUBLIC_LAUNCH_PROMO` approach).
- **Real Stripe subscription payments LIVE** — live keys + `STRIPE_PRICE_MEMBER` ($10/mo) / `STRIPE_PRICE_PRO` ($30/mo) + `STRIPE_SUBSCRIPTION_WEBHOOK_SECRET`. Created the missing `subscriptions` table + `posts.location` column on prod (migration history was out of sync). Checkout→webhook→`subscriptions`→entitlements verified. *(One unverified link: a real card checkout.)*
- **Removed all unconditional fake-demo fallbacks** (14 files; deleted `lib/demo-events.ts`) so the **440 real** businesses show. Petitions left as-is (no DB backing).
- **Seed** (`scripts/seed-launch.mjs`): realistic `broadcasts`/`posts`/`featured_lists` from real connector members (idempotent). Ran on prod (8/10/2).
- **Security:** RLS hardening — set `SUPABASE_SERVICE_ROLE_KEY` on prod (app writes via service-role, bypasses RLS), then **revoked anon grants** on `subscriptions`/`collab_*`/`posts` (migration `20260708120000_harden_table_grants`). In-memory **rate limiting** (`lib/rate-limit.ts`) on OTP/posts/upload/invites (works because CapRover = persistent container).
- **Twilio Verify OTP** — connector business-ownership OTP swapped Telnyx→Twilio Verify (`lib/twilio.js` + `otp.js`; SMS + voice fallback, no code at rest, no 10DLC). Verified working. Designed but not built: **Path A** — Twilio-independent ownership via Clerk phone possession + in-person `trustedPhone` match.
- **Enrichment (prolocaliq-style):** added a **Perplexity `sonar` web-search "story" layer** to the connector `enrich.js` + a `story` field (works with no website; tested on real businesses). Activated the dormant **Google Places** enrichment (fresh `GOOGLE_PLACES_API_KEY`). Built a server-side Places proxy (`lib/places.ts` + `/api/places/search|details`, key off-browser) and a **"search Google → pick → auto-fill" create UI** in `AdminPanel`.
- **Crons:** disabled `harvest-oakland`/`harvest-events`/`followup-intros` (env-flag guarded), kept `prune-collab-pool`; deployed to Trigger.dev.
- **Correction:** the "Firestore quota" issue was a **false alarm** — OTP 500s were from test member ids hitting Firestore's reserved `__…__` doc-id pattern; real members work, no Blaze needed.
- **Direction set:** consolidate the connector into the marketplace/Supabase (+`pgvector`) as a deliberate future north star (UI-first pivot obsoletes its conversational premise); not urgent.


### Changed / Fixed — UI polish + RSC fixes — 2026-06-30
- **Live page = the events surface**: added `components/live/CommunityEventsLive.tsx` below the venue "what's on right now" feed — real community events (`/api/events/feed`) split into **Events happening now** (today) + **Upcoming**, each with place filter tags, plus a **Feed / Map** view toggle (`EventsMap`/`EventsMapInner`, Leaflet pins placed by city/neighborhood centroid since `vendor_events` carry no lat/lng). Demo fallback floats event dates relative to now. `FeedEvent` gained an `eventDate` field for tz-safe now/upcoming bucketing.
- **TopNav dropdown** trimmed to **Home / Feed** — the **Events** item was removed (events now live on the Live tab).
- **Vendor dashboard commerce toggle**: extracted Products/Orders/Events + manage buttons into `components/vendor/CommerceCards.tsx` with a persisted **Commerce** on/off switch (default on). Replaces the always-locked-in-demo gating — Products/Orders are disabled only when the toggle is off.
- **Super-admin consolidation**: removed **Super-admin** + **Featured** from the dashboard Tools grid. `/vendor/admin` is now the single entry point (direct URL, `isAdmin`-gated); **Featured lists** is a 4th tab inside `AdminPanel` (`?tab=featured`). Act-on-behalf search now **normalizes** the connector member shape (`profile.name`/`memberType`/`city` → flat) so results/manage views show text, and persists the active **tab + picked member in the URL** so "Go back" / browser-back returns to the managed member instead of resetting to the Create tab. Wrapped in `<Suspense>` for `useSearchParams`.
- **Share composer "Go Live"**: a vendor-mode toggle (persisted) reveals a Go Live block — suggested live/upcoming fixtures, event picklist, matchup, "rooting for", duration — posting to `/api/broadcasts/:memberId` for the tagged venue.
- **Explore** category/facet filters are now a single horizontal scroll row.
- **Footer** gained a **Community events** link → `/vendor/organize`; **Organize events** removed from the Tools grid; Collabs (`NetworkManager`) membership defaults to **Basic**.
- **`HappeningThisWeek`** no longer renders the "Nothing scheduled yet" card — it self-hides when the feed is empty.
- **Fixed Clerk "multiple children" crash (RSC boundary)**: `SignInButton`/`SignOutButton` with a custom child throw when rendered from a Server Component. Made `app/shopper/page.tsx` a client component and moved the vendor sign-out into `components/vendor/VendorSignOut.tsx` (client). All six other Clerk-button usages were already `"use client"`.

### Added — Super-admin hub, AI-image premium quota, event organizers — 2026-06-28
- **`/vendor/admin`** super-admin hub (`AdminPanel.tsx`, isAdmin-gated): Create profile · Add by transcript · Act on behalf (member search → deep-links to manage any business's events/products). Surfaces the previously-hidden onboard flow; no more hand-typed `?memberId=` UUIDs.
- **AI product-image generation is now premium** (`lib/ai-credits.ts` + `ai_image_credits` table, migration `20260628200000`): 3 free lifetime per member, 3-per-scan cap (extras returned as raw-crop drafts), 10/day for premium; admins bypass. Over-limit → 402/429 + upgrade banner. Placeholder `/vendor/billing`.
- **Event-organizer sub-type** (`organizerFocus` in `lib/org-focus.ts`) distinct from community-service orgs; **multi-role lineups** (`lib/lineup-roles.ts`: vendor/performer/food/sponsor/partner/volunteer) in `/vendor/organize`; the **public event page** now renders the lineup grouped by role + "Public event" badge.
- **Real events in the community feed**: `GET /api/events/feed` + `getPublicEvents()` merge live `vendor_events`/connector events ahead of the demo feed (was demo-only).
- **Deployed** the connector `marketplace-create-member` + `marketplace-onboard` functions to prod; verified the admin-token chain; set `CONNECTOR_ADMIN_TOKEN`/`CONNECTOR_URL` locally.

### Added — One-brain in-app assistant (connector chat + embeddings-from-app) — 2026-06-28
- **Messages tab** leads with a pinned **WhatsLocal Assistant** conversation (`/messages/assistant`, `components/messages/AssistantChat.tsx`) — the same brain people text over SMS, in-app. `app/api/assistant/chat` proxies the connector's new **streaming** `chat-stream` endpoint (stable per-device `sessionId`), with a **local concierge fallback** (searches the live directory) when the connector is unavailable/erroring — so the tab never breaks.
- **Connector-agent (separate repo, deployed):** extracted the per-turn brain into `lib/runChatTurn.js` (chat.js delegates to it — one orchestration for web + app); added `chat-stream.js` (v1 streaming via `@netlify/functions` `stream()` + heartbeats, so it survives the ~30s edge cutoff; v2 functions don't get all env scopes on that site); made every OpenAI client in the import chain lazy; `patch-member.js` now **re-embeds** after a patch, so profile edits made in the app update Pinecone vectors. **Known blocker:** the connector's Firestore is over quota (`8 RESOURCE_EXHAUSTED`), degrading the brain, SMS, and `marketplace-search` until the Firebase quota is restored (Spark daily reset / Blaze). See `TASKS.md`.
- **Resilience:** `lib/api.ts getJson` now has a **4.5s timeout** (`AbortSignal.timeout`) so slow/erroring connector calls fail fast and pages fall back to demo/cached data instead of hanging ~8s.

### Added — Community resource explorer for residents (`/resources`) — 2026-06-28
- A separate, resident-facing resource hub (food, housing, health, legal aid, financial help, family, jobs, immigration, seniors, community orgs) — same look as the vendor hub but its own content + a **public AI guide**. `lib/community-resources.ts`, `app/resources/page.tsx`, `app/api/resources/chat` (grounded on the community catalog). `ResourceChat` parameterized (`endpoint`/`catalog`/`subtitle`/`starters`); shared `CATEGORY_META` extended with community categories. Shopper "Your space" consolidated to one "Explore local resources" entry → `/resources`.

### Added — Petitions & causes (`/petitions`) — 2026-06-28
- A home for local petitions so people find + sign them on their own time. Browsable feed with category chips + live progress bars; optimistic localStorage signing (demo content for now, no DB). `lib/demo-petitions.ts`, `app/petitions/page.tsx`, `components/petitions/PetitionsClient.tsx` (+ `PetitionsRail`, not currently surfaced). Reachable from the shopper space.

### Added — SF city hub with endorsed spots + newcomer articles (`/sf`) — 2026-06-28
- `/sf` hero + a toggle: **Endorsed** (default) — real SF/Bay spots loved/backed by real celebrities, with their Wikipedia/Wikimedia photos and an initials fallback (`SF_ENDORSEMENTS` in `lib/sf-stories.ts`, `components/sf/SfExplorer.tsx`) — and **Featured stories**, now full **articles** at `/sf/[id]` (`getSfStory`, `generateStaticParams`) written for newcomers (Karl the fog/microclimates, a city of villages, getting around, the Mission burrito/murals, North Beach & the Beats, Chinatown, Ferry Building, Castro).

### Added — Where to watch the World Cup (`/watch-world-cup`) — 2026-06-28
- A curated highlight of SF's best World Cup **watch parties** (evergreen — not live matches): Thrive City, Chase Center, Spark Social, China Basin Park, The Crossing at East Cut, Yerba Buena Lane. `lib/wc-watch-parties.ts`, `app/watch-world-cup/page.tsx`. Hero **"Watch World Cup"** button links here (was `/live?event=world-cup`). The live feed's `?event=` deep-link still works and now shows an event-aware "Where to watch the {event} in SF" header with **lean** cards (no event/team chips or per-card tags) via a `locked` flag.

### Added — Live "Go Live" what's-on shortcut — 2026-06-28
- The vendor **Go Live** composer shows a tappable strip of games happening now / soon (`lib/live-fixtures.ts`, relative-time like demo-live) — tap one to pre-fill the matchup + event (live → "now" mode, upcoming → "schedule" with kickoff time).

### Added — Featured promo cards in feed + directory — 2026-06-28
- **XEN0 × WhatsLocal merch** card (`components/feed/MerchCard.tsx`) and **Atlas** events card (`EventsCard.tsx`) injected after the 3rd / 6th card in the Community Feed and the home directory grid (vertical layout, hero image, placeholder links to swap).

### Added — Feedbase feedback widget — 2026-06-28
- `components/FeedbackWidget.tsx`: loads the Feedbase `widget.js` app-wide + identifies the Clerk user; a subtle **Send feedback** link in the footer opens the modal (the widget's own floating pill is hidden via `#fb-btn` CSS).

### Changed — Native app feel, footer, nav, filter sidebar, hero — 2026-06-28
- **Long-press callout fix:** global CSS disables the iOS WKWebView callout (Open/Copy/Share) + tap-highlight on links/buttons/images; text content stays selectable.
- **Footer** moved to `components/SiteFooter.tsx` (client) — **hidden on `/messages`** so the conversation view has no footer and its input bar pins above the bottom nav. Footer links trimmed (removed Feed/Shop/Categories; **Admin demo** → `/vendor`; **Send feedback**).
- **Hero buttons:** removed the old Shopper/Admin buttons; added **Watch World Cup** + **SF**.
- **Filter sidebar** (`components/FilterSidebar.tsx`) slides from the **left**, full-height, starting below the navbar (was a floating card / right side).
- **Home order:** the search bar moved **above** "Live now near you".

### Fixed — Collabs card horizontal overflow + events label — 2026-06-28
- `/vendor/network` cards extended past the viewport: the flex/grid **card itself** lacked `min-w-0`, so it grew to its content's min-content (~434px on a 390px screen). Added `min-w-0` to the cards (+ `block truncate` on the name Link, `break-words` on chat bubbles). Verified with the browser tool: `scrollWidth === clientWidth`.
- Events "Create event" button → **"Create"**.

### Changed — Vendor portal UX + demo access + shipped to prod — 2026-06-28
- **Slim one-row top nav** (`components/vendor/VendorNav.tsx`): Home · Live · **Collabs** (→ `/vendor/network`, find & invite) · Resources · QR. Pill style with **active/selected** highlight + hover/press feedback; fits the viewport (no horizontal scroll). Other tools moved to a dashboard **Tools** grid: **Your agent** (renamed from Assistant) · Giving (+ Featured for admins). **Organize** lives under My Events (button in the events header); **Onboard** hidden; **Network** is the Collabs tab.
- **"Go back" bar** (`components/vendor/VendorBackBar.tsx`) below the navbar on deeper pages (hidden on the 5 nav-tab destinations) → returns to the previous screen.
- **Demo shows everything**: gated vendor pages now resolve a representative demo member in demo mode (`lib/demo-server.ts` `demoMemberId()` by demo-type cookie) instead of the "link your profile" gate. Demo *writes* still no-op (`resolveActor` has no demo path).
- **Floating resources guide**: the `/vendor/resources` chat is now a sticky bottom-right circle button that expands a chat panel (`components/resources/ResourceChat.tsx`); catalog is full-width.
- **Shopper "Explore local resources"** opens the resources hub; demo banner removed.
- **Shipped:** deployed to Netlify prod (the iOS shell loads the hosted site, so web changes go live via `netlify deploy --build --prod`, not `cap sync`). **DB migrated:** `supabase db push` applied all 12 pending migrations after restoring the auto-paused xeno project.

### Added — Assistant knowledge via PDF drop-in + slim vendor nav — 2026-06-28
- Vendors configure their customer-service AI's knowledge by **typed notes or dropping PDFs** (`/vendor/assistant`): new `app/api/vendor/assistant/upload` extracts PDF text with `unpdf` → `business_knowledge` (`source: 'pdf'`), fed into `buildBusinessContext`. Persona/prompt + FAQs editing already existed.
- Vendor top nav slimmed to one row: **Home · Live · Collabs · Resources · QR**; Organize/Onboard/Network/Giving/Assistant/Featured moved to a dashboard **Tools** grid. Demo "viewing as" banner removed. Shopper "Explore local resources" now opens the resources hub.

### Added — Community memories (tagged-media walls) — 2026-06-28
- Posts tagged to a business/event/broadcast aggregate into an IG-style media wall + lightbox (`components/posts/MemoriesGrid.tsx`), on `/members/[id]`, `/events/[id]`, `/live/[id]`. `getPostsByMemberId`/`getPostsByEventId`; `GET /api/posts?member=|event=`; migration `20260628130000` (event index). Self-hides when empty.

### Added — Community giving + "Gives back" credit — 2026-06-28
- Vendor logs an open-ended gift (funds/goods/time/other) to a community org → org confirms via a self-serve inbox → public "Gives back" badge on the vendor profile. `/vendor/giving`, `lib/contributions.ts`, `community_contributions` (migration `20260628140000`), `components/giving/GivesBackBadges.tsx`.

### Added — Org typing + business facets + home filter sidebar — 2026-06-28
- Community orgs carry `serves` (small-businesses / individuals); `lib/org-focus.ts`, "Who they serve" chips.
- Businesses carry `businessSize` + `ownershipTags[]` (`lib/business-facets.ts`); captured at onboarding, editable on the profile (`components/business/BusinessFacets.tsx` → `PATCH /api/members/[id]/facets` → connector `patch-member`).
- Filterable via a slide-in `components/FilterSidebar.tsx` opened from a filter button in `SearchBar` on the home screen (+ on `/explore`). Client-side `matchesFacets`.

### Added — Collaborator network (invites + rooms) — 2026-06-28
- `/vendor/network`: search the local network → send a collab invite → accept → self-contained 1:1 room + polling chat. `lib/collab-network.ts`, `collab_invites`/`collab_rooms`/`collab_messages` (migration `20260628150000`). No connector-agent dependency.

### Added — Organizer toolkit (Luma-style) — 2026-06-28
- `/vendor/organize`: pick an event → **Lineup** (search vendors, multi-select, bulk-invite; event-scoped `collab_invites`) + **Messages** (group thread + **SMS/email blast** to the accepted lineup) + **Attendees**. `lib/event-comms.ts`, `lib/sms.ts` (connector proxy), `lib/email.ts` (Resend REST, no SDK). `event_messages` (migration `20260628160000`).
- **Free RSVP / attendees**: `vendor_events.capacity` + `event_attendees` (migration `20260628170000`), `lib/attendees.ts`, `components/events/RsvpButton.tsx`. `/events/[id]` now resolves organizer (`vendor_events`) events for a public RSVP page; member-profile event cards link there.

### Added — Pre-tagged venue onboarding + member creation — 2026-06-28
- Per-event **join QR** (in `/vendor/organize`) → conversational onboarding. Find-existing-listing path at `/events/[eventId]/join` (self-join → pending lineup; not-listed → `event_join_requests`, migration `20260628180000`).
- **Members can now be created** (not just claimed): connector functions `marketplace-create-member` + `marketplace-onboard` (the latter runs the connector's own profiling brain over a transcript → full profile + Pinecone vectors). `lib/api.ts` `createMember`/`onboardFromMessages`/`patchMember`.
- **Manual interview** tool `/vendor/onboard`: paste a conversation → AI extracts a reviewable profile (`lib/onboard.ts`, `/api/onboard/extract`) → create + optional event lineup + **grouping tags** (`member_tags`, migration `20260628190000`, "farmers market" etc.) with bulk-add-to-lineup.
- **QR self-onboarding** `/onboard?event=`: in-app booth chat (`/api/onboard/chat`) → `/api/onboard/finalize` (connector profiling + infers size/ownership facets + tags the lineup).

### Added — LinkedIn-style code sheet + native iOS NFC — 2026-06-28
- Home search-bar scanner rebuilt as a tabbed **Connect** sheet (`components/QrScanButton.tsx`): **NFC tag** (default) + **Scan** (camera). NFC priority: native iOS Core NFC → Web NFC (Android) → unsupported (`lib/native-nfc.ts`).
- Native plugin in `whatslocal-ios/local-plugins/capacitor-nfc/` (Swift `NfcPlugin`, `NFCNDEFReaderSession` → `Capacitor.Plugins.Nfc.scan()`); synced into SPM + `packageClassList`; Info.plist + `App.entitlements` added. Gated on Apple Developer Program enrollment + a physical device.

### Added — Native Composio commerce + Trigger.dev
- Brought Composio in-app (was a connector-agent proxy): `lib/composio.ts` (`@composio/core` client + `runTool`/`TOOL_SLUGS`/auth-config helpers) + `lib/composio-commerce.ts` (`connectStore` / `syncVendorCatalog` / `pushOrderToStore` / `getConnectedMemberIds`).
- `/api/vendor/composio` native connect + sync; Stripe webhook fires native `pushOrderToStore` order push-back.
- Shopify OAuth needs the vendor's **store subdomain** (`{shop}.myshopify.com`) — collected in the connect UI, passed via `AuthScheme.OAuth2({ subdomain })`.
- **Trigger.dev** project for this repo (`trigger.config.ts` + `trigger/composio.ts`): daily 3am `sync-all-catalogs` cron + on-demand `sync-vendor-catalog`; `/api/vendor/composio` falls back to inline sync when `TRIGGER_SECRET_KEY` is unset.
- Shopify (own app, custom OAuth) + Square (Composio managed) auth configs wired; verified against the live Composio API. See `features/composio-go-live-checklist.md`.

### Added — Live Now / World Cup discovery
- "Live Now" broadcasts (venues post what they're showing) + featured rails + World Cup host-city guides, with demo fallbacks (`app/live`, `app/featured`, `app/world-cup`, `components/live/*`, `lib/broadcasts.ts`/`demo-live.ts`/`featured.ts`/`live-events.ts`). Migrations `20260608120000`–`…150000`.

### Added — Instagram-style app shell
- `components/TopNav.tsx` — left `+` (→ `/share`), center **WhatsLocal ▾** dropdown (Home / Feed / Events), right cart. Replaces the old `auth-nav` header.
- `components/BottomNav.tsx` — Home / Reels (`/live`) / Messages (`/messages` stub) / Search (`/explore`) / Profile (`/shopper`).
- `app/explore` — IG Explore-style full-bleed square-tile grid of local businesses + name search.
- Safe-area handling (`viewport-fit=cover`, notch padding, locked scale to stop iOS input-zoom); `overflow-x-hidden` + `min-w-0` filter rows fixed mobile horizontal overflow; filter pills → horizontal scroll, uniform size.

### Added — Share composer + posts
- `app/share` + `components/share/ShareComposer.tsx` — Twitter/IG-style composer: text, image/video upload, tag a **business or event** (search **or QR scan**, auto-detects `/members` vs `/events`·`/live`), livestream link.
- `app/api/posts` (GET feed / POST create), `app/api/share/upload` (any signed-in user, demo-friendly), `lib/posts.ts`, migration `20260628120000_add_posts`. Demo mode soft-succeeds when the table isn't pushed yet.

### Added — Demo mode (testable admin/shopper without auth)
- `NEXT_PUBLIC_DEMO_MODE=1` opens the portal without Clerk for previewing each member type's admin UI. `lib/demo-admin.ts` + `components/DemoTypeSwitcher.tsx`; `middleware.ts` + `app/vendor/layout.tsx` skip auth in demo; `/demo` admin type picker.
- Home hero buttons: **Shopper admin** (`/shopper`) + **Admin demo** (`/vendor`). `app/shopper` shopper dashboard with sign-in/account control above "Your space".
- Vendor dashboard slimmed: compact Products/Orders/Events metric grid + Products/Events manage buttons.

### Roadmap specs (`features/`)
- `business-model.md`, `native-app.md` (Capacitor iOS — scaffolded in sibling `whatslocal-ios`), `storefront-theming.md`, `product-3d.md`, `virtual-tryon.md`, `event-photo-wall.md`, `community-directory.md`, `composio-go-live-checklist.md`.

## [Unreleased] — AI layer (branch `feat/ai-customer-service-assistant`)

### Added — Phase 1: Per-business customer-service assistant
- Auto-provisioned AI chat assistant on every `vendor`/`artist`/`organizer` profile (`components/AskAssistant.tsx`), streaming, grounded in that business's own data.
- `lib/business-context.ts` — assembles profile + products + events + settings + owner FAQs into a prompt (context-stuffed RAG; no vector store).
- `app/api/chat/[memberId]` — streaming chat route with a tool loop: `capture_lead` + `check_order_status`. Persists transcripts; returns `X-Conversation-Id`.
- `app/vendor/assistant` — owner config: enable/disable, tone, custom FAQs, captured-leads inbox.
- `lib/openai.ts` — lazy OpenAI client + model constants.
- Tables: `business_knowledge`, `chat_conversations`, `chat_messages`, `chat_leads`; `vendor_settings.assistant_enabled` / `assistant_persona`.

### Added — Phase 2: Image → catalog capture
- Snap a photo to populate the catalog, all behind an approval queue (`active=false` drafts → Approve).
  - **Scan a menu** → `gpt-4o` vision extracts items + prices → product drafts.
  - **Scan a flyer** → extracts event details, keeps the photo as the poster → event draft.
  - **Scan a counter/shelf** → vision bounding boxes → `sharp` crop → `gpt-image-1` clean product image → drafts (experimental; raw-crop fallback).
- Product write paths added to `app/api/products/[memberId]` (`POST/PATCH/DELETE`); new `vendor_events` table + `app/api/events/[memberId]`.
- `app/vendor/products` + `app/vendor/events` CRUD managers with draft-approval queue.
- `components/ImageCaptureUploader.tsx`, `app/api/upload`, `app/api/ai/extract`, `app/api/ai/detect-products`.
- `lib/admin.ts` — `ADMIN_CLERK_USER_IDS` allowlist + `resolveActor()` gating all writes (vendor on own member; admin on any via `?memberId=`).
- `lib/storage.ts` + `marketplace-media` public Storage bucket (created via migration).
- Published `vendor_events` surfaced on the member profile and fed into the assistant's context.

### Added — Small-business resources hub (`/vendor/resources`)
- Searchable, category-filterable catalog of local small-business support resources (legal, accounting, energy, green, accessibility, permits, funding, education, market research, library, support orgs) — everything in one place.
- "Recommended for you" rail: deterministic, rule-based matching of resources to the business's own profile (`recommendResources` in `lib/resources.ts`), e.g. a restaurant gets induction/green/accessibility picks with a plain reason. No model call, unit-tested, free.
- Grounded chat guide (`app/api/vendor/resources/chat`, streaming) that explains resources and renders them as inline cards via a `suggest_resources` tool.
- `lib/resources.ts` — static catalog (editing data = editing the file) with `tags`/`recommendFor`/`city`/`cost` shaped for later improvement; unverified entries render a "Find this program →" search link instead of a fabricated URL.
- UI: `app/vendor/resources/page.tsx`, `components/resources/{ResourceCard,ResourceGrid,ResourceChat}.tsx`; vendor nav link + dashboard quick-access card.
- `tests/resources.test.ts` — unit tests for the recommender + catalog integrity (no API cost).
- **v1 ships a placeholder seed (5 entries); real resource curation is the remaining work** (see CLAUDE.md "Pending / TODO").

### Added — QR codes (basic) + marketplace scanner
- Vendor portal `/vendor/qr`: client-side QR generator pointing at the vendor's profile (`…/members/{id}`), color presets, PNG + SVG download. Pure (`lib/qr.ts` via `qrcode`) — no AI, no network.
- Marketplace: a QR-scan button beside the search bar (`components/QrScanButton.tsx`, `@zxing/browser`) opens the camera and routes a scanned profile code straight to that member page.
- **Tiered + independent by design:** basic generation and the scanner share no code and import nothing AI-related, so they can't be broken by the AI tiers. AI poster will be a separate file behind `NEXT_PUBLIC_QR_POSTER` (still unbuilt). Note: camera scanning requires HTTPS or localhost.
- Vendor nav link + dashboard quick-access card.

### Added — QR codes (AI-stylized, Tier 1, flag-gated)
- `app/api/vendor/qr/stylize` (flag `NEXT_PUBLIC_QR_AI=1`, **off by default**): `gpt-image-1` generates a background, then the **real** QR is composited on a white card over it (`lib/qr-compose.ts` via sharp) and uploaded to Supabase. Because the real QR sits on top, the output always scans even with a busy background; if the AI call fails the UI falls back to the basic generator.
- `components/qr/AiQr.tsx` — style presets + optional prompt + download; only mounted when the flag is on. Each generate is a billable `gpt-image-1` call (~$0.04).
- `tests/qr.test.ts` — deterministic, **free** (no OpenAI): composites a QR over a noisy synthetic background and decodes it back (`jsqr`) to prove scannability + output dimensions.
- **Verified live once** end-to-end (real `gpt-image-1` background → composite → `jsqr` decoded back to the exact profile URL): the AI background does not break scannability in practice. To enable in any environment: set `NEXT_PUBLIC_QR_AI=1` (and `OPENAI_API_KEY`).
- Independent + revertible: AI files import sharp/gpt-image-1; `lib/qr.ts`/`BasicQr` import none of it, so unsetting the flag or deleting the AI files leaves basic + scanner intact.

### Added — Testing
- Vitest live integration suite (`tests/`) exercising real OpenAI + Supabase: DB CRUD, assistant grounding, vision extraction, `gpt-image-1` generation, counter detection + crop, Storage upload. `npm test`.

### Fixed
- Granted `anon`/`authenticated` privileges on `vendor_profiles`, `orders`, `vendor_settings`, `stripe_connect_accounts`, and `products` (write) — the original migrations created open RLS but no role grants, so anon-key access failed with `42501`. (Surfaced by integration tests.)
- `extract`/`detect` routes now fetch image bytes server-side and send them to OpenAI inline (base64) instead of passing Supabase storage URLs, which OpenAI's downloader handled slowly/unreliably.
- Synced the live `xeno` Supabase DB, which was behind by the `2026-05-18` migration set (orders, vendor_settings, delivery fields, vendor_profiles Clerk rename).

### Setup required
- Set `OPENAI_API_KEY` (optional: `ADMIN_CLERK_USER_IDS`, `SUPABASE_SERVICE_ROLE_KEY`).
- `supabase db push` to apply the new migrations (assistant tables, `vendor_events`, media bucket, grants).

### Not yet built
- Phase 3 — voice AI receptionist (OpenAI Realtime + Twilio) and a reservations/booking subsystem.
