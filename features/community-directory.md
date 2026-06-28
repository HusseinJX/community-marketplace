# Community / Local-Resource Directory + AI Recommendations

A personalized directory of **community organizations & local resources**, surfaced on two surfaces with different intent:

- **Shopper side** — *personal* help: orgs a person might need (housing, food, health, legal aid, youth/senior services, immigrant services, mental health, etc.). "A directory of local resources for someone who may need help in the local area."
- **Vendor side** — *business* help: orgs aligned with small businesses (SCORE, MEDA, Renaissance, SBDC, chambers, grants, permits, legal/accounting clinics, etc.). Extends the existing `/vendor/resources` hub.

Both: explore, search, **chat with AI for recommendations**, and get **personalized recs from an embedding** of the user learned during onboarding.

## What already exists (build on this, don't rebuild)
- **Community orgs = the `organizer` member type.** Already in the data, browsable on the home "Community" filter + category/city landing pages.
- **Semantic search infra.** The connector-agent has Pinecone embeddings; `searchMembers(query)` already does NL → semantic search with `matchedOn[]` breadcrumbs. Shopper NL queries can run through this today.
- **Vendor resources hub** (`/vendor/resources`): searchable/filterable catalog cards, a rule-based "Recommended for you" rail (`recommendResources`, driven by `buildBusinessContext`), and a grounded streaming chat guide (`app/api/vendor/resources/chat`, single `suggest_resources` tool → inline ` RESOURCES:[...] ` markers). Catalog is static (`lib/resources.ts`). This IS the vendor side of this feature — extend it.
- **Grounded-chat pattern** + `lib/openai.ts` + the assistant tool-loop pattern are reusable for the recommendation chat.

## The two surfaces

### Shopper — personal local-resource directory
1. **Onboarding (NL → embedding).** After sign-up, ask the shopper about themselves / what they're looking for in natural language ("new to the area, have two kids, looking for affordable childcare and ESL classes"). Embed that → store a **shopper profile embedding**.
2. **Personalized recs.** Match the shopper embedding against `organizer` member embeddings (vector search) → "Community orgs for you" rail.
3. **Explore.** A browsable directory of community orgs (by need category, neighborhood), each with a detail page to explore the org.
4. **Search + AI chat.** NL search (reuse `searchMembers`) + a grounded chat ("I need help with rent this month") that recommends specific orgs via a `suggest_orgs` tool (mirror the resources chat's `suggest_resources` marker pattern).

### Vendor — business-resource directory (extend `/vendor/resources`)
- Same shape, but scoped to **business-aligned** orgs/resources (not personal).
- Add real org entries to `lib/resources.ts` (the TODO already in CLAUDE.md: SCORE/Renaissance/MEDA, SBDC, legal/accounting clinics, permits, grants…).
- Upgrade recs from rule-based → **embedding-based** ("why this fits your business" using `buildBusinessContext`'s embedding vs. resource embeddings).

## Data model
- **Org embeddings:** `organizer` members embedded (reuse the connector's embedding pipeline / `backfill-embeddings`). Tag orgs with a **need taxonomy** (housing, food, legal, health, childcare, immigrant services, business) — separate from the commerce taxonomy.
- **Shopper profile:** new table `shopper_profiles` (`clerk_user_id`, `bio_text`, `embedding`, `needs[]`, `created_at`) — needs anon/authenticated/service_role grants (repo convention). Embedding stored for matching.
- **Resource/org chat:** reuse `chat_conversations`/`chat_messages` patterns if persistence wanted.

## Architecture / reuse
- **Recommendations** = vector similarity (shopper or business embedding × org embeddings). The connector already does Pinecone search; expose an endpoint that ranks `organizer` members by similarity to a given embedding + optional need filter.
- **AI chat** = grounded streaming (OpenAI), single tool `suggest_orgs(ids[])` → inline ` ORGS:[...] ` markers the client renders as cards (exact mirror of the resources chat).
- **Onboarding embedding** = `lib/openai.ts` embeddings call on the NL bio → store on `shopper_profiles`.
- Personal vs business is the **same engine, different corpus + taxonomy + intent prompt**.

## Build phases
1. **Shopper directory (no personalization):** an `organizer` browse/explore surface with need-category filters + detail pages + NL search via `searchMembers`. (Mostly reuses existing data + search.)
2. **AI recommendation chat (shopper):** grounded chat with `suggest_orgs` markers → org cards.
3. **Onboarding + embedding + "for you" rail:** capture NL bio → embed → store → personalized vector-matched recs.
4. **Vendor side:** extend `/vendor/resources` with real business-org entries + embedding-based recs (upgrade `recommendResources`).
5. **Org embeddings + need taxonomy backfill** (connector pipeline).

## Notes
- Never fabricate org links — same rule as the resources hub (real `url`, or a search-fallback link).
- Personal-data sensitivity: the shopper bio/embedding is personal; store minimally, disclose, allow deletion.
- The `organizer` orgs are the same entities shoppers already see under "Community" — this just makes them a first-class, personalized, AI-navigable directory.

## Related
`../app/vendor/resources` (existing hub) · `lib/resources.ts` · `lib/business-context.ts` · connector `searchMembers`/Pinecone · `features/business-model.md` (this is part of the SaaS/value story).
