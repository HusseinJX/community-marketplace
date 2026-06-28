# Storefront Theming (multi-tenant, per-vendor design)

## Goal
Let vendors customize their page on WhatsLocal so it looks distinctly *theirs* — while underneath every page is the **same data-driven site** rendered by **our** components. One backend, per-tenant presentation. Mental model: Shopify themes / Linktree / Carrd / Substack — shared platform, per-tenant theme config.

**Non-negotiable:** content and presentation are separated. Theming changes *how* a page looks, never *what data* it shows or how it's stored. SEO/JSON-LD/canonical/AI-assistant/QR/commerce all stay shared and untouched.

## Why this approach (vs. alternatives)
- **vs. vendors hosting their own site:** every page stays our renderer → fixes/upgrades hit everyone at once, no snowflakes to maintain, commerce + SEO stay wired.
- **vs. arbitrary code/CSV uploads:** the customization artifact is a **structured theme JSON** we validate and render. CSV is the wrong shape for design (it's tabular — good for bulk *product* import, a separate feature). Structured config = safe, previewable, upgradeable.

## Levels (ship in this order)

### Level 1 — Design tokens (huge visual range, zero risk) ← build first
A JSON of design tokens applied via **CSS variables** (Tailwind v4 is built for this).
- Colors: `primary`, `accent`, `bg`, `surface`, `text`, `muted`
- Typography: `headingFont`, `bodyFont` (from a **curated** set via `next/font`), base size/scale
- Shape: `radius` (sharp → pill), `borderStyle`, button style (solid/outline/ghost)
- Hero: image URL + overlay style + height
- Mode: light / dark / auto; density (compact/comfortable)

Render: member page wraps content in a container with `style={{ '--brand': tokens.primary, '--font-heading': … }}`; utilities reference the vars. Fully SSR/SEO-safe. **This alone makes pages look totally distinct.**

### Level 2 — Layout config (page-builder)
An **ordered array of section blocks**, each with a `variant` and an on/off toggle:
`hero | about | products | gallery | events | hours | map | reviews | cta`
Renderer maps each block → our component + variant. Still our components, our data — composed per vendor (Shopify-sections / Framer model). Vendors reorder, toggle, pick variants.

### Level 3 — Custom CSS / custom blocks (power users, ship last)
Scoped custom CSS or sanitized custom HTML blocks. Powerful, risky (XSS, layout breakage). Gate behind validation, CSS scoping to the vendor container, HTML sanitization (or iframe-sandbox custom blocks). Only when there's demand.

## AI-assisted theming (the differentiator)
Vendor describes a vibe — *"warm, artisanal, earth tones, serif headings, photo-forward"* — and the OpenAI layer (already in-app) returns a **validated theme JSON** (tokens + layout). Live preview → tweak → save. Reuses existing `lib/openai.ts`; emitting structured config is trivial vs. the vision/image work already shipped. Captures the "vibecode your own look" energy, but output is **structured config we render**, not loose code. Great onboarding moment: "describe your shop, watch it style itself."

## Data model
- New table `vendor_themes` (or a `theme jsonb` column on `vendor_profiles`):
  - `member_id` (PK), `theme jsonb`, `updated_at`
  - **Grants:** anon (read) / authenticated / service_role — per this repo's convention (vendor write paths use the anon key; all vendor tables need explicit grants — see migrations `…160000`/`…170000`).
- `theme` JSON shape (validate with a schema on save):
  ```jsonc
  {
    "tokens": { "colors": {…}, "headingFont": "…", "bodyFont": "…", "radius": "…", "hero": {…}, "mode": "auto", "density": "comfortable" },
    "layout": [ { "type": "hero", "variant": "full-bleed", "enabled": true }, … ],
    "customCss": null   // Level 3 only; sanitized + scoped
  }
  ```

## Rendering (fits current architecture)
- Member profile pages are **server components** — they fetch the theme alongside member data, set CSS vars on a wrapper, and render sections by `layout`. **Data layer untouched** → `isIndexable()`, JSON-LD, canonical, OG all keep working.
- Default theme when none set → current clean look (no vendor is worse off).
- Fonts: curate ~12 pairings via `next/font` (performance + no arbitrary webfont loading).
- Keep theming **presentation-only**: never let a theme change which products/events render or their data.

## Vendor editor
- New route `app/vendor/storefront/` — client component with **live preview** that writes the theme JSON via a Clerk-authed API route (`app/api/vendor/theme/`, gated via `resolveActor` like other vendor writes; admins can edit any member's via `?memberId=`).
- Controls: token pickers (color/font/radius/hero), layout reorder + toggles, "Generate from a vibe" (AI), Reset to default.
- Save validates against the theme schema; reject unknown/oversized payloads.

## Security / safety
- Validate every saved theme against a strict schema (zod or JSON-schema); cap size.
- Level 1–2 are pure config → inherently safe.
- Level 3 custom CSS: scope to `.vendor-storefront-{memberId}` container, sanitize, no `@import`/`url()` to untrusted origins; custom HTML sanitized or iframe-sandboxed.

## SEO note
Because the data + our components are unchanged, all SEO/AEO output (metadata, JSON-LD, sitemap, llms.txt) is unaffected. Theming must stay strictly presentational — this is the guardrail that keeps the "same data site underneath" promise true.

## Build order / scope
1. **Level 1 v1:** `vendor_themes` migration (with grants) → CSS-var theming on the member page → basic `/vendor/storefront` editor (color/font/radius/hero). ~80% of visual distinctiveness for ~20% of the work.
2. **AI vibe generator** → theme JSON from a text prompt + live preview. The demo that sells vendors.
3. **Level 2** layout blocks (reorder/toggle/variants).
4. **Level 3** custom CSS/blocks — only on demand.

## Related
- Bulk product import via CSV is a *separate* feature (catalog data, not design) — worth pairing as the no-integration catalog path for vendors not on Shopify/Square. See the Composio/inventory tiers.
- Inventory system-of-record model (who owns stock truth) is its own concern — theming is orthogonal.
