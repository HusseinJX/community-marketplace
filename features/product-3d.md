# Product 3D + In-Room AR

## Goal
Let vendors turn a flat product photo into an interactive **3D model** shoppers can spin, zoom, and **place in their space via AR** ("see this couch in your living room"). Opt-in per product, flag-gated, async — mirrors the QR AI-tier pattern (Tier 0 = 2D image today, Tier 1 = AI 3D, off by default).

## Reality check (set expectations)
Single-image → 3D is **category-dependent**:
- **Great:** furniture, decor, lamps, rugs, planters, ceramics, candles, mugs, bottles, jewelry, shoes, bags, toys — discrete objects with a clean silhouette.
- **Poor:** food on a plate, apparel flat-lays, glass/chrome/transparent items, multi-object scenes.
→ So it's **opt-in per product**, with a preview-before-save step and a reject option. Don't auto-3D every image.

**Furniture/decor is the hero category** — best 3D quality *and* the audience that most wants "view in your space." Lead with it.

## Tech / providers
OpenAI has no 3D endpoint (`gpt-image-1` is 2D), so this **adds a non-OpenAI dependency** — a deliberate break from the "single AI provider = OpenAI" rule. Options with APIs (as of 2025):
- **Meshy**, **Tripo** — purpose-built image→3D, textured GLB out, good DX. Most practical for v1.
- **Stability (Stable Fast 3D / SPAR3D)** — fast single-image→mesh.
- **Tencent Hunyuan3D**, **Microsoft TRELLIS** — open-source, self-hostable to avoid per-gen fees later.

Output formats:
- **GLB** (web standard) → renders in-browser with Google's `<model-viewer>` (orbit/zoom + AR).
- **USDZ** (Apple AR Quick Look) → iOS "view in your space." Generate/convert both.

## In-room AR (the freebie)
Once a GLB/USDZ exists, **`<model-viewer>` gives AR for free**: WebXR on Android, AR Quick Look on iOS, real-scale placement. No extra tech beyond the 3D generation — furniture-in-room AR *is* this feature, not a separate one.

## Architecture (fits existing patterns)
- **Flag-gate** like QR Tier 1: `NEXT_PUBLIC_PRODUCT_3D=1`, off by default; the 3D path imports the new provider that the 2D path never touches → blockable/revertible.
- **Run generation on Trigger.dev** (the project already set up) — gen is slow (seconds–minutes) + costs per run, so it must be **async + retriable + cached**. Task `generate-product-3d`:
  1. input: `productId` + source image URL
  2. call provider → poll until complete
  3. download GLB (+ USDZ) → upload to Supabase Storage (`marketplace-media`, under `models/<memberId>/`)
  4. write `model_url` / `model_usdz_url` + `model_status` on the product
- **DB:** add to `products`: `model_url text`, `model_usdz_url text`, `model_status text` (`none|generating|ready|failed`), `model_source_image text`.
- **Vendor UI:** a "Make 3D" button per product (in `app/vendor/products/`), preview the result, Save or Discard. Opt-in, never automatic.
- **Render:** on the product/member page, when `model_status === 'ready'`, mount `<model-viewer>` (with `ar` enabled + AR button); otherwise fall back to the 2D image. Lazy-load the web component so non-3D pages aren't affected.

## Cost / latency / safety
- Async only (Trigger.dev) — never block a request on generation.
- Cache: generate **once** per product image, store in Supabase, reuse.
- Opt-in per product → controls spend and avoids garbage models on food/apparel.
- Surface failures to the vendor (`model_status = failed`) with a retry.

## Build order
1. Flag + DB fields + Trigger.dev `generate-product-3d` task (Meshy or Tripo) → store GLB in Supabase.
2. Vendor "Make 3D" + preview/approve in `app/vendor/products/`.
3. `<model-viewer>` render + AR on product pages (GLB + USDZ).
4. Later: USDZ conversion polish, self-hosted model (TRELLIS/Hunyuan3D) to cut per-gen cost.

## Related
- Clothes try-on is a **different** pipeline (2D diffusion VTON, not 3D) — see `features/virtual-tryon.md`.
- Reuses the image-capture pipeline (`ImageCaptureUploader`) as the source-image origin.
