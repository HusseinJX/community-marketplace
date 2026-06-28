# Composio — Go-Live Checklist (deferred live tests)

Code is **built + verified** (build/lint/tsc green; Composio API key + Shopify auth config authenticated against the live API; connect path returns a real redirect URL). What remains is **live end-to-end testing**, deferred to a later session. This doc captures the exact state so it can be picked up cold.

## ✅ Done / verified
- Native Composio commerce in this app: `lib/composio.ts` + `lib/composio-commerce.ts` (connect / syncVendorCatalog / pushOrderToStore / getConnectedMemberIds).
- `app/api/vendor/composio/route.ts` — native connect + sync (dispatches Trigger.dev task, inline fallback).
- `app/api/stripe-webhook/route.ts` — native `pushOrderToStore` order push-back.
- `app/vendor/integrations/page.tsx` — Shopify store-subdomain field + on-connect auto-sync.
- Trigger.dev: `trigger.config.ts` + `trigger/composio.ts` (`sync-vendor-catalog` on-demand + `sync-all-catalogs` daily 3am cron).
- Smoke test: `scripts/composio-smoke.mjs` (auth + auth-config resolve verified; `--initiate` exercises connect).

## Env state (`.env.local`)
- `COMPOSIO_API_KEY` — set (`ak_rPc…`), verified.
- `COMPOSIO_SHOPIFY_AUTH_CONFIG_ID=ac_RI9TmSSnc0Qo` — **own Shopify app** (custom OAuth2). App = `WhatsLocal Marketplace`, deployed (`whatslocal-marketplace-2`) with redirect `https://backend.composio.dev/api/v1/auth-apps/add`, scopes `read_products,read_orders,write_orders`. Shopify app config repo: `~/Desktop/dev/shopify-whatslocal-app` (`shopify.app.toml`).
- `COMPOSIO_SQUARE_AUTH_CONFIG_ID=ac_SILv-yFjL4jK` — set. **Composio managed** auth config (not an own Square app) → see the `initiate()` vs `link()` caveat below.
- `TRIGGER_PROJECT_REF=proj_rrbgogjvtsebrjeeavqe`, `TRIGGER_SECRET_KEY=tr_dev_…` — set.
- `MARKETPLACE_URL=http://localhost:3000` — **set to localhost for local testing**; switch back to `https://comfy-zuccutto-73b27f.netlify.app` for prod, and set all `COMPOSIO_*`/`TRIGGER_*` env in Netlify too.

## ⚠️ Square managed config — `initiate()` vs `link()` caveat
- `ac_SILv-yFjL4jK` is a **Composio managed** Square auth config (set in `.env.local`).
- **Our code uses `connectedAccounts.initiate()`** (`lib/composio-commerce.ts` → `connectStore`). Per Composio's changelog, `initiate()` is being **retired for *managed* OAuth on redirectable schemes** (cutover **2026-05-08** new orgs / **2026-07-03** all orgs); managed configs may need **`connectedAccounts.link()`** instead.
  - **Shopify is fine** — it's a **custom** (own-app) config, unaffected by the retirement.
  - **Square is managed** → before the Square live test, verify `initiate()` still works for it; if it throws `ComposioLegacyConnectedAccountsEndpointRetiredError`, switch the Square path to `.link()` (or recreate Square as a custom Square Developer app, like we did for Shopify). Small code branch in `connectStore` if needed.

## ⬜ Deferred live tests
1. **Shopify connect E2E** — `/vendor/integrations` → Connect Shopify → enter dev-store subdomain → Authorize → land back → auto-sync. Needs: a vendor login with a linked business + a Shopify **dev store with sample products**. Verify products land in Supabase `products` (source `shopify`, correct `external_id`).
2. **Square** — create the Square auth config (managed or own Square Developer app) → set `COMPOSIO_SQUARE_AUTH_CONFIG_ID` → connect a Square sandbox → verify catalog sync. (Square needs no store subdomain.)
3. **Daily cron** — confirm `sync-all-catalogs` runs in the Trigger.dev dashboard (or trigger manually) and sweeps connected vendors.
4. **Order push-back** — buy a synced product → Stripe `payment_intent.succeeded` → confirm `pushOrderToStore` creates a paid order in the vendor's Shopify/Square. (Optional hardening: move push-back onto a retriable Trigger.dev task.)
5. **Managed-vs-custom** — if using any managed OAuth config, verify `.initiate()` vs `.link()` per the retirement note above.

## How to resume locally
- Dev server: `npm run dev` (localhost:3000). Trigger worker: `npm run trigger:dev`.
- Smoke test: `node scripts/composio-smoke.mjs` (add `--initiate` to test a real connect).
