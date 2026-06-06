# Changelog

All notable changes to this project are documented here.

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
