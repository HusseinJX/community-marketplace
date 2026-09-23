import { describe, it, expect } from 'vitest'
import sharp from 'sharp'
import { getOpenAI, VISION_MODEL, CHAT_MODEL, IMAGE_MODEL } from '@/lib/openai'
import { buildBusinessContext, buildSystemPrompt } from '@/lib/business-context'
import { uploadImage } from '@/lib/storage'
import { getProductsByMember } from '@/lib/vendor-connect'
import { makeMenuPng, makeCounterPng } from './helpers/synthetic'

const ZAHAB = '89516919-256f-4a95-96df-fc9d285f664a' // seeded member with real products

const PRODUCTS_SCHEMA = {
  type: 'object',
  properties: {
    products: {
      type: 'array',
      items: {
        type: 'object',
        properties: { name: { type: 'string' }, price_cents: { type: ['integer', 'null'] } },
        required: ['name', 'price_cents'],
        additionalProperties: false,
      },
    },
  },
  required: ['products'],
  additionalProperties: false,
} as const

const DETECT_SCHEMA = {
  type: 'object',
  properties: {
    products: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          x: { type: 'number' }, y: { type: 'number' }, w: { type: 'number' }, h: { type: 'number' },
        },
        required: ['name', 'x', 'y', 'w', 'h'],
        additionalProperties: false,
      },
    },
  },
  required: ['products'],
  additionalProperties: false,
} as const

describe('Supabase Storage upload (live)', () => {
  it('uploads an image and returns a reachable public URL', async () => {
    const png = await makeMenuPng()
    const { publicUrl } = await uploadImage(png, { prefix: `test/${Date.now()}`, filename: 'menu.png', contentType: 'image/png' })
    expect(publicUrl).toContain('marketplace-media')
    const res = await fetch(publicUrl)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('image')
  })
})

describe('OpenAI vision — menu extraction (live)', () => {
  it('extracts menu items + prices from a menu image', async () => {
    const png = await makeMenuPng()
    const dataUrl = `data:image/png;base64,${png.toString('base64')}`

    const r = await getOpenAI().chat.completions.create({
      model: VISION_MODEL,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Extract every menu item and its price in cents. Do not invent.' },
            { type: 'image_url', image_url: { url: dataUrl } },
          ],
        },
      ],
      response_format: { type: 'json_schema', json_schema: { name: 'p', schema: PRODUCTS_SCHEMA, strict: true } },
    })
    const products = JSON.parse(r.choices[0].message.content!).products as { name: string; price_cents: number | null }[]
    expect(products.length).toBeGreaterThanOrEqual(4)
    const names = products.map((p) => p.name.toLowerCase()).join(' ')
    expect(names).toContain('latte')
    const latte = products.find((p) => p.name.toLowerCase().includes('latte'))
    expect(latte?.price_cents).toBe(450)
  })
})

describe('Assistant brain — context + grounded answer (live)', () => {
  it('builds context from real data and answers grounded in it', async () => {
    const ctx = await buildBusinessContext(ZAHAB)

    // The member's LIVE catalogue must show up in the assembled knowledge.
    //
    // This used to assert the literal string 'consultation', a seeded product
    // that stopped existing on 2026-08-22 when Printify was connected and the
    // four manual products were deactivated — so the test failed for a month
    // while the code it covers was fine. Asserting against a row that can be
    // deactivated by ordinary catalogue work is a test that breaks on data,
    // not on regressions. Ask the question the test actually means instead:
    // whatever this member currently sells, does the brain know about it?
    const active = await getProductsByMember(ZAHAB)
    expect(active.length).toBeGreaterThan(0)
    const blob = ctx.knowledgeBlob.toLowerCase()
    const known = active.filter((p) => blob.includes(p.name.toLowerCase()))
    expect(known.length).toBeGreaterThan(0)

    // Ask a direct factual lookup — this tests grounding/retrieval (not the
    // model's comparative arithmetic, which is non-deterministic on a mini model).
    //
    // The product is picked from the LIVE catalogue for the same reason as
    // above: this used to ask about a seeded "Energy Consultation" at $150,
    // and once that row was gone the assistant correctly answered "I don't
    // have information about that" — a PASSING behaviour scored as a failure.
    const subject = known[0]
    const r = await getOpenAI().chat.completions.create({
      model: CHAT_MODEL,
      messages: [
        { role: 'system', content: buildSystemPrompt(ctx) },
        { role: 'user', content: `How much does the ${subject.name} cost?` },
      ],
      temperature: 0,
    })
    const answer = r.choices[0].message.content!.toLowerCase()
    // The price must come from the catalogue, not from the model. Compared in
    // DOLLARS because that is what the knowledge blob renders — and note
    // `SupabaseProduct.price` holds CENTS despite the bare name, so this
    // assertion reads 4400 as $44.
    expect(answer).toContain(String(Math.round(subject.price / 100)))
  })
})

describe('OpenAI image generation — gpt-image-1 (live)', () => {
  it('generates a product image and returns valid image bytes', async () => {
    const r = await getOpenAI().images.generate({
      model: IMAGE_MODEL,
      prompt: 'A clean professional catalog photo of a red ceramic coffee mug on a plain white background.',
      size: '1024x1024',
    })
    const b64 = r.data?.[0]?.b64_json
    expect(b64).toBeTruthy()
    const buf = Buffer.from(b64!, 'base64')
    expect(buf.length).toBeGreaterThan(5000)
    // verify it's a real decodable image
    const meta = await sharp(buf).metadata()
    expect(meta.width).toBeGreaterThan(0)
  })
})

describe('Counter detection — vision boxes + crop (live)', () => {
  it('detects distinct products with bounding boxes and crops one', async () => {
    const png = await makeCounterPng()
    const r = await getOpenAI().chat.completions.create({
      model: VISION_MODEL,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Identify each distinct product. Give a tight bounding box as fractions of the image (x,y top-left; w,h size; 0..1).' },
            { type: 'image_url', image_url: { url: `data:image/png;base64,${png.toString('base64')}` } },
          ],
        },
      ],
      response_format: { type: 'json_schema', json_schema: { name: 'd', schema: DETECT_SCHEMA, strict: true } },
    })
    const products = JSON.parse(r.choices[0].message.content!).products as { name: string; x: number; y: number; w: number; h: number }[]
    expect(products.length).toBeGreaterThanOrEqual(2)
    for (const p of products) {
      expect(p.x).toBeGreaterThanOrEqual(0)
      expect(p.x).toBeLessThanOrEqual(1)
      expect(p.w).toBeGreaterThan(0)
    }

    // crop the first detection with sharp (mirrors the route)
    const meta = await sharp(png).metadata()
    const W = meta.width!, H = meta.height!
    const d = products[0]
    const left = Math.floor(Math.max(0, Math.min(1, d.x)) * W)
    const top = Math.floor(Math.max(0, Math.min(1, d.y)) * H)
    const width = Math.max(1, Math.min(W - left, Math.round(d.w * W)))
    const height = Math.max(1, Math.min(H - top, Math.round(d.h * H)))
    const crop = await sharp(png).extract({ left, top, width, height }).png().toBuffer()
    expect(crop.length).toBeGreaterThan(100)
  })
})
