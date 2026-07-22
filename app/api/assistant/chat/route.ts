import { rateLimit } from '@/lib/rate-limit'
import { getOpenAI, CHAT_MODEL } from '@/lib/openai'
import { searchMembers } from '@/lib/api'
import type OpenAI from 'openai'

export const runtime = 'nodejs'

// In-app WhatsLocal assistant. PRIMARY path proxies the connector agent's shared
// "one brain" (the same brain people text over SMS) via its streaming endpoint —
// so improving the connector brain makes both SMS and this in-app chat smarter
// at once. FALLBACK path (when the connector/token isn't configured or errors)
// is a local OpenAI concierge that searches the live directory, so the tab keeps
// working regardless.
//
// Wire protocol to the client (same for both paths): the body is whitespace
// heartbeats (to keep the connection alive while the brain works) followed by a
// trailing JSON object `{ reply, members? }`. The client trims heartbeats and
// parses the trailing object.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type ClientMessage = { role: 'user' | 'assistant'; content: string }

interface MemberCardData {
  id: string
  name: string
  category?: string
  city?: string
  type?: string
}

export async function POST(req: Request) {
  const limited = rateLimit({ req, name: 'assistant-chat', id: null, limit: 20, windowMs: 60_000, ipLimit: 20 })
  if (limited) return limited

  let body: { messages?: ClientMessage[]; sessionId?: string }
  try {
    body = await req.json()
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  const history = (body.messages ?? [])
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-20)

  if (history.length === 0 || history[history.length - 1].role !== 'user') {
    return new Response('Last message must be from the user', { status: 400 })
  }

  const sessionId =
    typeof body.sessionId === 'string' && UUID_RE.test(body.sessionId)
      ? body.sessionId
      : crypto.randomUUID()

  // ── Primary: the connector "one brain" (streaming) ──────────────────────────
  // Base defaults to the connector (same as lib/api.ts), so the ONLY env needed
  // to flip this on is CONNECTOR_ADMIN_TOKEN. Without the token we fall back.
  const base =
    process.env.CONNECTOR_URL ||
    process.env.NEXT_PUBLIC_API_BASE ||
    'https://community-connector-agent.netlify.app'
  const token = process.env.CONNECTOR_ADMIN_TOKEN
  if (base && token) {
    try {
      const upstream = await fetch(`${base.replace(/\/$/, '')}/.netlify/functions/chat-stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ messages: history, sessionId }),
      })
      if (upstream.ok && upstream.body) {
        // Forward the connector's heartbeats to keep the client alive; read to
        // the end. If the brain returned a real reply, we've already streamed it
        // through. If it errored mid-stream (e.g. Firestore quota), append a
        // local-concierge reply as a NEW trailing JSON — the client parses the
        // last object, so the working answer wins.
        const upstreamBody = upstream.body
        const out = new ReadableStream({
          async start(controller) {
            const enc = new TextEncoder()
            const dec = new TextDecoder()
            const reader = upstreamBody.getReader()
            let raw = ''
            try {
              while (true) {
                const { done, value } = await reader.read()
                if (done) break
                const chunk = dec.decode(value, { stream: true })
                raw += chunk
                controller.enqueue(enc.encode(chunk)) // forward (heartbeats + connector JSON)
              }
            } catch {
              /* connector stream dropped → fall through to local */
            }
            if (!hasReply(raw)) {
              const { reply, members } = await localConcierge(history)
              controller.enqueue(enc.encode('\n' + JSON.stringify({ reply, members })))
            }
            controller.close()
          },
        })
        return new Response(out, {
          headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
        })
      }
      // non-OK → fall through to local
    } catch {
      // unreachable → fall through to local
    }
  }

  // ── Fallback: local concierge over the live directory ───────────────────────
  const { reply, members } = await localConcierge(history)
  return new Response(JSON.stringify({ reply, members }), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}

// Did the connector stream end with a usable reply (vs an error / nothing)?
function hasReply(raw: string): boolean {
  const t = raw.trim()
  const start = t.lastIndexOf('{')
  if (start < 0) return false
  try {
    const obj = JSON.parse(t.slice(start))
    return typeof obj?.reply === 'string' && obj.reply.length > 0
  } catch {
    return false
  }
}

const FALLBACK_SYSTEM = [
  'You are the WhatsLocal AI concierge — a warm local guide helping someone discover nearby businesses, makers, artists, events, and community organizations.',
  'When someone is looking for a place, service, maker, or org, call search_local. Never invent businesses or links. Keep replies short and friendly.',
].join('\n')

const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'search_local',
      description: 'Search the WhatsLocal directory for local businesses, makers, artists, organizers, or community orgs.',
      parameters: {
        type: 'object',
        properties: { query: { type: 'string', description: 'Natural-language search.' } },
        required: ['query'],
        additionalProperties: false,
      },
    },
  },
]

async function localConcierge(
  history: ClientMessage[]
): Promise<{ reply: string; members: MemberCardData[] }> {
  const members: MemberCardData[] = []
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: FALLBACK_SYSTEM },
    ...history.map((m) => ({ role: m.role, content: m.content })),
  ]
  const openai = getOpenAI()

  try {
    for (let turn = 0; turn < 3; turn++) {
      const completion = await openai.chat.completions.create({
        model: CHAT_MODEL,
        messages,
        tools,
        temperature: 0.5,
      })
      const msg = completion.choices[0]?.message
      if (!msg) break

      if (msg.tool_calls?.length) {
        messages.push(msg)
        for (const tc of msg.tool_calls) {
          if (tc.type !== 'function') continue
          let query = ''
          try {
            query = JSON.parse(tc.function.arguments || '{}').query ?? ''
          } catch {
            /* ignore */
          }
          let summary = 'No matches.'
          try {
            const res = await searchMembers(query, { limit: 6 })
            const cards = (res.results ?? []).slice(0, 6).map((m) => {
              const p = m.profile ?? {}
              return {
                id: m.id,
                name: (p.businessName as string) || (p.name as string) || 'Local member',
                category: (p.category as string) || undefined,
                city: [p.neighborhood, p.city].filter(Boolean).join(', ') || undefined,
                type: (p.memberType as string) || undefined,
              }
            })
            members.push(...cards)
            if (cards.length) summary = cards.map((c) => `${c.name}${c.category ? ` (${c.category})` : ''}`).join('; ')
          } catch {
            summary = 'Search unavailable.'
          }
          messages.push({ role: 'tool', tool_call_id: tc.id, content: summary })
        }
        continue
      }

      return { reply: msg.content ?? 'How can I help you find something local?', members: dedupe(members) }
    }
  } catch {
    return { reply: "Sorry — I couldn't reach the assistant. Please try again.", members: [] }
  }
  return { reply: 'How can I help you find something local?', members: dedupe(members) }
}

function dedupe(members: MemberCardData[]): MemberCardData[] {
  const seen = new Set<string>()
  return members.filter((m) => (seen.has(m.id) ? false : (seen.add(m.id), true)))
}
