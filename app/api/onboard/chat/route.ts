import { NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'
import { getOpenAI, CHAT_MODEL } from '@/lib/openai'
import { onboardingSystemPrompt } from '@/lib/onboard'

export const runtime = 'nodejs'

interface Msg {
  role: 'user' | 'assistant'
  content: string
}

// POST { messages, eventName? } — one turn of the onboarding conversation.
// Public (the person hasn't signed in yet); creation later requires sign-in.
export async function POST(req: Request) {
  const limited = rateLimit({ req, name: 'onboard-chat', id: null, limit: 20, windowMs: 60_000, ipLimit: 20 })
  if (limited) return limited

  const body = await req.json().catch(() => ({}))
  const messages: Msg[] = Array.isArray(body.messages) ? body.messages.slice(-20) : []
  const eventName = body.eventName ? String(body.eventName) : undefined
  const brief = body.brief ? String(body.brief).slice(0, 2000) : undefined

  try {
    const completion = await getOpenAI().chat.completions.create({
      model: CHAT_MODEL,
      messages: [
        { role: 'system', content: onboardingSystemPrompt(eventName, { brief }) },
        ...messages.map((m) => ({
          role: m.role === 'assistant' ? ('assistant' as const) : ('user' as const),
          content: String(m.content ?? ''),
        })),
      ],
    })
    const reply = completion.choices[0]?.message?.content ?? fallbackFor(messages)
    return NextResponse.json({ reply })
  } catch {
    return NextResponse.json({ reply: fallbackFor(messages) })
  }
}

// On the OPENER turn (no messages yet) a failure must not hand back a canned
// "tell me about your business" — that's the researchable question the whole
// flow exists to avoid (see NEVER_ASK in lib/onboard.ts), and it's truthy, so it
// would sail past the client's own fallback and become the first thing the
// member reads. Return empty and let the caller own its opener.
function fallbackFor(messages: Msg[]): string {
  return messages.length === 0 ? '' : 'Sorry — say that again?'
}
