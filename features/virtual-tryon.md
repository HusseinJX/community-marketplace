# Virtual Try-On (clothes)

## Goal
Let shoppers see a garment "worn" before buying — AI generates an image of a person wearing the vendor's garment. Opt-in per product, flag-gated, async. **Privacy is the defining constraint** (shopper photos), so it's specced separately from Product 3D and rolled out stock-model-first.

## What this is (and isn't)
- **Is:** image-based **virtual try-on (VTON)** — a diffusion model takes a **garment image** (vendor already has it) + a **person image** → outputs a 2D image of that person wearing the garment.
- **Is NOT:** 3D, AR, or fit/size measurement. It shows **appearance, not fit**. Different tech entirely from `features/product-3d.md` — no shared code.

Tech (as of 2025): diffusion-based try-on (TryOnDiffusion-style, IDM-VTON/OOTDiffusion/CatVTON lineage). Hosted options/providers: FASHN, Kolors/Kwai try-on, models on Replicate, Google shopping try-on. Pick one with a clear **no-training-on-input** data policy.

## Reality check
- **Works well:** tops, dresses, simple garments, clear front pose.
- **Weak:** shoes, accessories, layering, unusual poses, exact fit.
→ Opt-in per product; preview before showing; let vendors disable per item.

## Privacy model (the core of this feature)
Shoppers may upload a photo of **themselves** — sensitive personal data. Non-negotiables:
- **Phase 1 = stock models only.** Shopper picks from a set of model body types/poses; **no shopper photo at all.** Most of the value, ~none of the risk. Ship this first.
- **Phase 2 = shopper selfie (optional, explicit opt-in):**
  - Explicit consent screen before upload.
  - **Ephemeral storage** — process then delete; never retain beyond the request (or a short, disclosed TTL).
  - Contractual **no-training** guarantee from the provider; prefer providers that don't persist inputs.
  - No use of the image for anything but generating that one try-on.
  - Clear deletion + privacy disclosure; consider regional rules (BIPA/biometric, GDPR) before enabling.
- Never train on, share, or repurpose shopper images. Treat selfies as the highest-sensitivity data in the app.

## Architecture (reuses existing infra)
- **Flag-gate** like QR/3D tiers: `NEXT_PUBLIC_TRYON=1`, off by default.
- **Async on Trigger.dev** (same project) — task `generate-tryon`: garment image + person image (stock or consented upload) → provider → poll → output image.
  - Stock-model results are **cacheable** (garment × model is deterministic-ish) → store in Supabase Storage, reuse across shoppers.
  - Selfie results are **ephemeral** → return to that shopper, do not persist the input; optionally don't persist the output either.
- **DB:** `products.tryon_enabled boolean`; optional `tryon_previews jsonb` (cached stock-model renders per garment).
- **Vendor UI:** per-garment "Enable try-on" toggle in `app/vendor/products/`; mark garment image as the try-on source.
- **Shopper UI:** "Try it on" on apparel product pages → pick a stock model (Phase 1) or upload with consent (Phase 2) → see the render.

## Cost / latency
- Per-generation cost + seconds of latency → async, opt-in, and cache the stock-model variants aggressively.

## Build order
1. **Phase 1 — stock models only:** flag + `tryon_enabled` + Trigger.dev `generate-tryon` (garment × stock model) → cache in Supabase → "Try it on" picker on apparel pages. No shopper photos → minimal risk.
2. **Phase 2 — consented selfie:** consent flow + ephemeral processing + no-training provider + deletion/disclosure. Only after the privacy model is reviewed.
3. Later: size/fit guidance (separate from appearance), more poses/body types.

## Related
- Furniture/object AR + 3D is the *other* visualization track — see `features/product-3d.md` (different tech, no privacy surface).
