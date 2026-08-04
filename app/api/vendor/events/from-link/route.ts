import { NextResponse } from 'next/server'
import { getOpenAI, CHAT_MODEL } from '@/lib/openai'
import { resolveActor } from '@/lib/admin'
import { rateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'

const EVENT_SCHEMA = {
  type: 'object',
  properties: {
    is_event: { type: 'boolean', description: 'True only if the page describes a specific real event' },
    title: { type: ['string', 'null'] },
    description: { type: ['string', 'null'] },
    date: { type: ['string', 'null'], description: 'Human-readable date as printed (e.g. "Sat, May 10")' },
    time: { type: ['string', 'null'] },
    location: { type: ['string', 'null'], description: 'Venue / address if shown' },
  },
  required: ['is_event', 'title', 'description', 'date', 'time', 'location'],
  additionalProperties: false,
} as const

// Turn a fetched HTML page into a compact text blob for extraction: prefer any
// schema.org JSON-LD (event pages usually embed it), then fall back to the
// visible text (tags stripped), plus <title>/meta description.
function pageToText(html: string): string {
  const parts: string[] = []
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]
  if (title) parts.push(`TITLE: ${title.trim()}`)
  const desc = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1]
  if (desc) parts.push(`META: ${desc.trim()}`)
  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    parts.push(`JSONLD: ${m[1].trim().slice(0, 4000)}`)
  }
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  parts.push(`TEXT: ${text.slice(0, 6000)}`)
  return parts.join('\n\n').slice(0, 12000)
}

// POST { url, memberId? } → fetch the link, AI-extract an event. Returns a draft
// (not created) so the vendor can confirm before it lands in their events.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const url = String(body.url ?? '').trim()
  if (!/^https?:\/\//i.test(url)) {
    return NextResponse.json({ error: 'Paste a valid event link (https://…).' }, { status: 400 })
  }

  const actor = await resolveActor(body.memberId)
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const limited = rateLimit({ req, name: 'event-from-link', id: actor.memberId, limit: 15, windowMs: 60_000 })
  if (limited) return limited

  let html: string
  try {
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WhatsLocalBot/1.0)' },
      signal: AbortSignal.timeout(10000),
    })
    if (!resp.ok) throw new Error(`fetch ${resp.status}`)
    html = await resp.text()
  } catch {
    return NextResponse.json({ error: "Couldn't open that link. Check the URL and try again." }, { status: 400 })
  }

  const completion = await getOpenAI().chat.completions.create({
    model: CHAT_MODEL,
    messages: [
      {
        role: 'user',
        content:
          'Extract the event advertised on this page: title, description, date, time (as printed), and location. ' +
          'Set is_event=false if the page is not a specific event. Do not invent details.\n\n' +
          pageToText(html),
      },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: { name: 'extracted_event', schema: EVENT_SCHEMA, strict: true },
    },
  })

  let parsed: Record<string, unknown> = {}
  try {
    parsed = JSON.parse(completion.choices[0]?.message?.content ?? '{}')
  } catch {
    return NextResponse.json({ error: 'Could not read an event from that link.' }, { status: 502 })
  }

  if (!parsed.is_event || !parsed.title) {
    return NextResponse.json({ error: "That link doesn't look like an event." }, { status: 422 })
  }

  return NextResponse.json({
    event: {
      title: parsed.title as string,
      description: (parsed.description as string) ?? null,
      event_date: (parsed.date as string) ?? null,
      event_time: (parsed.time as string) ?? null,
      location: (parsed.location as string) ?? null,
      source_url: url,
    },
  })
}
