# iOS shipping rules (full)

Split out of CLAUDE.md. The condensed version lives there; this is the authoritative long form.

## ⚠️ SHIPPING RULES — the iOS app is LIVE ON THE APP STORE (2026-08-02)
**Read this before every deploy.** The shipped app is a thin native shell that loads the **live hosted site** (`whatslocal-ios/capacitor.config.ts` → `server.url: 'https://whatslocal.ai'`; nothing web-side is bundled into the IPA). So **a CapRover deploy IS an app update** — it reaches every App Store user on their next launch, with no review, no submission, no way to roll back through Apple. That's the superpower and the danger.

**Ships instantly via CapRover (no submission):** every page/component/style in `app/` + `components/`, all API routes, DB migrations, connector/Supabase logic, AI prompts, push/email sending, copy, pricing-page content, tier gating, bug fixes.

**Requires a new Xcode build + App Review** (anything compiled into the IPA): **splash screen** (`ios/App/App/Assets.xcassets` + `Splash.storyboard`) and **app icon**; app name / version / build number; **`capacitor.config.ts` itself** — it's compiled to `capacitor.config.json` inside the bundle, so `allowNavigation`, `presentationOptions`, `contentInset`, `backgroundColor`, and even changing `server.url` all need a rebuild; Capacitor plugins (NFC, camera barcode, Google auth, push, StoreKit IAP); `Info.plist` permission strings; `App.entitlements`; the offline fallback page in `www/`.

**⏳ WAITING ON A NEW BUILD — iPad (patched 2026-08-22, NOT shipped).** The app renders on
an iPad as a phone-sized window in the middle of the screen. That is not a CSS problem and
no web deploy can fix it: `ios/App/App.xcodeproj/project.pbxproj` had
`TARGETED_DEVICE_FAMILY = 1` (iPhone only) in **both** Debug and Release, so iPadOS runs it
in iPhone compatibility mode and never tells the site the screen is 1024pt wide. Patched on
disk to `"1,2"` (Universal) in `~/Desktop/dev/whatslocal-ios` — **uncommitted, because that
directory is not a git repo.** What still has to happen:

- a new Xcode build + App Review (it is compiled into the IPA),
- **iPad screenshots in App Store Connect become mandatory** — 13" display; a binary
  declaring iPad support will not pass submission without them,
- open it in the iPad simulator at half-width first: `UIRequiresFullScreen` is not set, so
  Split View will resize the webview and review will try it.

Already in place, so nothing else needs touching: `LaunchScreen.storyboard` exists (without
one iOS letterboxes even a universal app) and `UISupportedInterfaceOrientations~ipad`
already declares all four orientations. The site itself was checked at 1024×1366 and
1366×1024 — desktop layout, no horizontal scroll, bottom nav correctly giving way to the
top nav. `UIRequiredDeviceCapabilities = ["armv7"]` is legacy Capacitor-template noise;
left alone deliberately so the build changes one thing.

**THE RULES — a web deploy is still bound by App Store guidelines. Breaking one of these gets the app PULLED, not merely rejected, because it never passed review:**
1. **NEVER render a Stripe subscription checkout when `isNativeApp()`.** Apple 3.1.1 forbids selling digital subscriptions outside IAP. **This is no longer a "hide the paywall" rule — iOS SELLS subscriptions, via StoreKit IAP (live since 2026-07-29; a real Apple-sourced `subscriptions` row exists in prod).** What the rule means now:
   - **The purchase happens on `/vendor/billing` only**, through `BillingPlans` → `lib/native-iap.ts` → the native `Iap` plugin. Web keeps Stripe. Both write the same `subscriptions` table, so `getEntitlements()` has one source of truth.
   - **Any price shown inside the app MUST come from StoreKit**, never a hardcoded string — that's why `BillingPlans` fetches localized products before rendering, and why the `/join` done-screen and the VendorHome upsell deliberately show **no price** natively and just route to `/vendor/billing`. Adding a hardcoded "$30/mo" to a native surface is the rejection.
   - **Restore Purchases must stay reachable** (Apple requires it) — it's in `BillingPlans`, and "manage subscription" points at iOS Settings, not the Stripe portal.
   - The server never trusts a client-claimed plan: it's derived from the verified `productId` (`lib/apple-iap.ts`, Apple-signed JWS + cert chain). Don't add a code path that sets a plan from the client.
   - **Physical goods and real-world services are NOT covered by 3.1.1** — shop orders, tickets, bookings and deliveries correctly stay on Stripe Connect in the app. Moving them to IAP would hand Apple 30% of a vendor's sandwich; don't.
2. **NEVER enable the ad pixels without wiring ATT first.** Setting `NEXT_PUBLIC_META_PIXEL_ID` / `NEXT_PUBLIC_GOOGLE_ADS_ID` / `NEXT_PUBLIC_GA4_ID` makes the *native app* "track" per Apple's definition. That requires (a) an ATT prompt gating them (`@capacitor-community/app-tracking-transparency` — a native change) and (b) a Tracking declaration in App Store Connect. The 2026-07-29 App Review reply truthfully said no tracking occurs; flipping these on a web deploy makes that statement false. See Pending/TODO.
3. **Don't ship a web change that would raise the app's age rating or add a reviewable capability** (new UGC surface without report/block, gambling, etc.). Moderation exists (see [[ugc-moderation]]) — keep any new user-content surface inside it.

**THE BUILD TRAP now protects the App Store app, not just the website.** `NEXT_PUBLIC_*` is inlined at build time and `next build` loads `.env.local` (demo `=1` locally). `.env.production.local` pins `NEXT_PUBLIC_DEMO_MODE=0` and `pk_live` — **never remove those lines.** The pre-deploy gate is mandatory, every time: `PORT=3100 npx next start` → `curl -sI localhost:3100/vendor` **must be 307 → /vendor/sign-in**. A **200 means demo mode is baked ON** and that build must not ship — it would open the whole vendor portal (products, orders, customer DMs) to every App Store user, unauthenticated. Grepping the bundle does NOT work (minification folds the constant away). Full detail in **Demo Mode** below.

**APNs environment (verified 2026-08-02, currently CORRECT — don't "fix" it):** CapRover prod has `APNS_ENV=production`, which matches App Store builds — Xcode rewrites `aps-environment` to `production` on distribution export regardless of the `development` value in `App.entitlements`. So push to real App Store users works. The mismatch now runs the *other* way: a **local Xcode debug build** on your own phone gets a **sandbox** token, registers it into the prod DB, and prod rejects + prunes it. Don't misdiagnose that as "push is broken" — and don't flip prod to `sandbox` to chase it.

**No forced-update mechanism exists.** Native changes only reach users who update from the App Store, so an old shell can be talking to a new web app indefinitely — keep web changes backward-compatible with the shipped native bridge (`lib/native-*.ts`).
