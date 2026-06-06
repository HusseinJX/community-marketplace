import { NextResponse } from 'next/server'
import sharp from 'sharp'
import { toFile } from 'openai'
import { getOpenAI, VISION_MODEL, IMAGE_MODEL } from '@/lib/openai'
import { resolveActor } from '@/lib/admin'
import { uploadImage } from '@/lib/storage'

export const runtime = 'nodejs'
export const maxDuration = 300

const DETECT_SCHEMA = {
  type: 'object',
  properties: {
    products: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          description: { type: ['string', 'null'] },
          // bounding box as fractions of the image (0..1)
          x: { type: 'number' },
          y: { type: 'number' },
          w: { type: 'number' },
          h: { type: 'number' },
        },
        required: ['name', 'description', 'x', 'y', 'w', 'h'],
        additionalProperties: false,
      },
    },
  },
  required: ['products'],
  additionalProperties: false,
} as const

const clamp01 = (n: number) => Math.min(1, Math.max(0, n))

// POST { imageUrl, memberId? } — detect distinct products on a counter/shelf,
// crop each, generate a clean catalog image, return draft products.
// Experimental: LLM bounding boxes are approximate; everything lands behind the
// approval queue, and we fall back to the raw crop if generation fails.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const imageUrl = String(body.imageUrl ?? '')
  if (!imageUrl) return NextResponse.json({ error: 'Missing imageUrl' }, { status: 400 })

  const actor = await resolveActor(body.memberId)
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const openai = getOpenAI()

  // 1. Load the source image once (used for both detection + cropping). Sent
  // inline to OpenAI rather than as a URL — its downloader can be slow fetching
  // Supabase storage URLs (surfaced by integration tests).
  let srcBuf: Buffer
  try {
    const resp = await fetch(imageUrl)
    if (!resp.ok) throw new Error(`fetch ${resp.status}`)
    srcBuf = Buffer.from(await resp.arrayBuffer())
  } catch {
    return NextResponse.json({ error: 'Could not read image' }, { status: 400 })
  }
  const meta = await sharp(srcBuf).metadata()
  const W = meta.width ?? 0
  const H = meta.height ?? 0
  if (!W || !H) return NextResponse.json({ error: 'Unreadable image' }, { status: 502 })
  const dataUrl = `data:${meta.format === 'jpeg' ? 'image/jpeg' : 'image/png'};base64,${srcBuf.toString('base64')}`

  // 2. Detect products + boxes
  const detection = await openai.chat.completions.create({
    model: VISION_MODEL,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Identify each distinct, individual product visible in this photo (e.g. items on a counter or shelf). For each, give a short name, an optional description, and a tight bounding box as fractions of the image width/height (x,y = top-left corner; w,h = size; all between 0 and 1). Do not include background, people, or duplicates of the same physical item.',
          },
          { type: 'image_url', image_url: { url: dataUrl } },
        ],
      },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: { name: 'detected_products', schema: DETECT_SCHEMA, strict: true },
    },
  })

  let detected: { name: string; description: string | null; x: number; y: number; w: number; h: number }[] = []
  try {
    detected = JSON.parse(detection.choices[0]?.message?.content ?? '{}').products ?? []
  } catch {
    return NextResponse.json({ error: 'Could not parse detection' }, { status: 502 })
  }

  // 3. Crop + refine each detected product (best-effort per item)
  const results = []
  for (let i = 0; i < detected.length; i++) {
    const d = detected[i]
    try {
      const left = Math.floor(clamp01(d.x) * W)
      const top = Math.floor(clamp01(d.y) * H)
      const width = Math.max(1, Math.min(W - left, Math.round(clamp01(d.w) * W)))
      const height = Math.max(1, Math.min(H - top, Math.round(clamp01(d.h) * H)))
      const crop = await sharp(srcBuf).extract({ left, top, width, height }).png().toBuffer()

      let imageBuf = crop
      let generated = false
      try {
        const gen = await openai.images.edit({
          model: IMAGE_MODEL,
          image: await toFile(crop, 'crop.png', { type: 'image/png' }),
          prompt: `Clean professional product catalog photo of "${d.name}", centered on a plain white background, soft studio lighting, no text or props.`,
          size: '1024x1024',
        })
        const b64 = gen.data?.[0]?.b64_json
        if (b64) {
          imageBuf = Buffer.from(b64, 'base64')
          generated = true
        }
      } catch (e) {
        console.error('Image generation failed, using raw crop:', e)
      }

      const { publicUrl } = await uploadImage(imageBuf, {
        prefix: `products/${actor.memberId}`,
        filename: `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}.png`,
        contentType: 'image/png',
      })

      results.push({
        name: d.name,
        description: d.description,
        price: 0,
        currency: 'usd',
        image_url: publicUrl,
        refined: generated,
      })
    } catch (e) {
      console.error('Product crop failed:', e)
    }
  }

  return NextResponse.json({ products: results })
}
