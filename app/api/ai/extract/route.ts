import { NextResponse } from 'next/server'
import { getOpenAI, VISION_MODEL } from '@/lib/openai'
import { resolveActor } from '@/lib/admin'
import { gateCapability } from '@/lib/gate'
import { rateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'

const PRODUCTS_SCHEMA = {
  type: 'object',
  properties: {
    products: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          description: { type: ['string', 'null'] },
          price_cents: { type: ['integer', 'null'], description: 'Price in cents (e.g. $12.50 -> 1250)' },
          currency: { type: 'string' },
        },
        required: ['name', 'description', 'price_cents', 'currency'],
        additionalProperties: false,
      },
    },
  },
  required: ['products'],
  additionalProperties: false,
} as const

const EVENTS_SCHEMA = {
  type: 'object',
  properties: {
    events: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          description: { type: ['string', 'null'] },
          date: { type: ['string', 'null'], description: 'Human-readable date as printed' },
          time: { type: ['string', 'null'] },
          location: { type: ['string', 'null'] },
        },
        required: ['title', 'description', 'date', 'time', 'location'],
        additionalProperties: false,
      },
    },
  },
  required: ['events'],
  additionalProperties: false,
} as const

// POST { imageUrl, mode: 'products' | 'events', memberId? }
// Vision-extracts structured drafts from a menu (products) or flyer (events).
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const imageUrl = String(body.imageUrl ?? '')
  const mode = body.mode === 'events' ? 'events' : 'products'
  if (!imageUrl) return NextResponse.json({ error: 'Missing imageUrl' }, { status: 400 })

  const actor = await resolveActor(body.memberId)
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  // OpenAI vision — cap per member.
  const limited = rateLimit({ req, name: 'ai-extract', id: actor.memberId, limit: 20, windowMs: 60_000 })
  if (limited) return limited

  // Menu capture → commerce (Pro); flyer/event capture → organize events (Pro).
  const gated = await gateCapability(
    actor.memberId,
    mode === 'events' ? 'organizeEvents' : 'commerce',
    { bypass: actor.isAdmin }
  )
  if (gated) return gated

  // Fetch the image server-side and send it inline (base64) rather than handing
  // OpenAI the storage URL — OpenAI's downloader can be slow/flaky fetching
  // Supabase public URLs (surfaced by integration tests).
  let dataUrl: string
  try {
    const resp = await fetch(imageUrl)
    if (!resp.ok) throw new Error(`fetch ${resp.status}`)
    const ct = resp.headers.get('content-type') || 'image/png'
    const buf = Buffer.from(await resp.arrayBuffer())
    dataUrl = `data:${ct};base64,${buf.toString('base64')}`
  } catch {
    return NextResponse.json({ error: 'Could not read image' }, { status: 400 })
  }

  const instruction =
    mode === 'products'
      ? 'Extract every distinct menu item / product from this image. Capture name, a short description if shown, and the price in cents. Do not invent items or prices that are not visible.'
      : 'Extract the event(s) advertised on this flyer/poster: title, description, date, time, and location exactly as printed. Do not invent details.'

  const completion = await getOpenAI().chat.completions.create({
    model: VISION_MODEL,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: instruction },
          { type: 'image_url', image_url: { url: dataUrl } },
        ],
      },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: mode === 'products' ? 'extracted_products' : 'extracted_events',
        schema: mode === 'products' ? PRODUCTS_SCHEMA : EVENTS_SCHEMA,
        strict: true,
      },
    },
  })

  let parsed: Record<string, unknown> = {}
  try {
    parsed = JSON.parse(completion.choices[0]?.message?.content ?? '{}')
  } catch {
    return NextResponse.json({ error: 'Could not parse extraction' }, { status: 502 })
  }

  if (mode === 'products') {
    const products = (parsed.products as { name: string; description: string | null; price_cents: number | null; currency: string }[] | undefined) ?? []
    return NextResponse.json({
      mode,
      products: products.map((p) => ({
        name: p.name,
        description: p.description,
        price: typeof p.price_cents === 'number' ? p.price_cents : 0,
        currency: (p.currency || 'usd').toLowerCase(),
      })),
    })
  }

  const events = (parsed.events as { title: string; description: string | null; date: string | null; time: string | null; location: string | null }[] | undefined) ?? []
  return NextResponse.json({
    mode,
    // keep the uploaded flyer as the event poster
    events: events.map((e) => ({
      title: e.title,
      description: e.description,
      event_date: e.date,
      event_time: e.time,
      location: e.location,
      poster_image_url: imageUrl,
    })),
  })
}
