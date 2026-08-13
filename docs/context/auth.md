# Auth architecture + commerce layer (full)

## Auth Architecture
**All auth is Clerk.** WorkOS has been fully removed.

- **Accounts = Google or Apple ONLY (email-based).** Phone was fully removed from account sign-in/sign-up (2026-07-22) — email is the account/notification channel; there's no account SMS. **Phone survives ONLY as BUSINESS verification** (the ownership OTP to a member's Google-listing number: `/join` step `code2`, `/api/otp`, `maskPhone`/`phoneHint`). The vendor login (`components/auth/VendorPhoneLogin.tsx` — filename kept) and `/join` "who" step are just two OAuth buttons. No email/password option.
- **Shoppers** — optional Clerk modal sign-in. All browse routes remain public. `AuthNav` shows `UserButton` when signed in.
- **Vendors** — same Clerk account, protected portal at `/vendor/*`. Middleware `createRouteMatcher(['/vendor((?!/sign-in).*)'])` + `auth.protect()`. Server components use `auth()` from `@clerk/nextjs/server`.
- **OAuth mechanics** (`components/auth/OAuthBrandIcons.tsx` shared marks; `/sso-callback` route = `AuthenticateWithRedirectCallback`):
  - **Web** — `authenticateWithPopup` (popup + `/sso-callback`, keeps the page mounted).
  - **iOS app (Capacitor WKWebView)** — the popup is blocked, so (`lib/native.ts isNativeApp()` gate): **Apple** = Clerk `oauth_apple` **redirect kept inside the webview** (`appleid.apple.com`/`*.apple.com` in `whatslocal-ios/capacitor.config.ts allowNavigation`; the native `oauth_token_apple` strategy 401s `authorization_invalid` from the web SDK — it's gated to Clerk's native SDK). **Google** = native `capacitor-google-auth` plugin → id token → `clerk.authenticateWithGoogleOneTap` (`lib/native-auth.ts`). Google needs its iOS OAuth client in the SAME Google-Cloud project as the web client + `GIDServerClientID`=web client id so the token audience matches what Clerk trusts; a Clerk "Native Application" (bundle `ai.whatslocal.app`, prefix `6UWM5JUAC5`) is registered. `/join`'s in-app Apple redirect stashes flow state in `sessionStorage.join_apple_resume` and resumes on return. **Verified working on a physical device 2026-07-22.**
- One middleware file (`middleware.ts`), one auth system, zero WorkOS dependencies.
- `vendor_profiles` table links `clerk_user_id` → `member_id` (renamed from `workos_user_id` in migration `20260518130000`).

## Commerce Layer (Phases 1–3)

**Payments (Stripe Connect):** Vendors get Express accounts. Buyers checkout per-vendor. 5% platform fee via `application_fee_amount` + `transfer_data.destination`. Every payment creates a durable `orders` row in Supabase (via `confirm-payment` + `payment_intent.succeeded` webhook durability path).

**Catalog sync (Composio) — native to this app:** Vendors connect Shopify or Square via OAuth Magic Link in `/vendor/integrations`. The Composio logic now lives **here**, not in the connector-agent: `lib/composio.ts` (`@composio/core` client + `runTool`/`TOOL_SLUGS`/auth-config helpers) and `lib/composio-commerce.ts` (`connectStore` / `syncVendorCatalog` / `pushOrderToStore` / `getConnectedMemberIds`, against Supabase via service-role→anon fallback). `/api/vendor/composio` calls these directly. Products sync into Supabase `products` with `source` (shopify|square) + `external_id`, upserted on `member_id,external_id`. **Trigger.dev** (its own project for this repo — `trigger.config.ts` + `trigger/composio.ts`) exposes `syncVendorCatalog` three ways: a **daily 3am cron** (`sync-all-catalogs` `schedules.task` → sweeps every connected vendor), an **on-demand task** (`sync-vendor-catalog`) fired by the "Sync Now" button, and **on-connect** (auto-sync when the vendor returns from OAuth). Until `TRIGGER_SECRET_KEY` is set, "Sync Now" falls back to an inline in-request sync. Completed orders are pushed back into the vendor's store via `pushOrderToStore` from the Stripe webhook (created as a paid order, not a draft). **Commerce no-ops until `COMPOSIO_API_KEY` (+ the two auth-config ids) is set.**

**Delivery (Uber Direct):** After payment, buyer sees `DeliveryRequestModal` — enters address, gets fee quote, confirms. Quote ID + address saved on order. When vendor clicks "Ready — Dispatch Uber" in dashboard, `POST /api/uber/dispatch` fires. Uber webhooks update order status and SMS buyer via connector-agent's `sms-send` function.

**Order status lifecycle:** `paid → ready → dispatched → delivered | refunded`
